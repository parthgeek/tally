import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withOrgFromJWT } from '../../_shared/with-org.ts';
import { trackConnection, captureException } from '../../_shared/monitoring.ts';
import { createPlaidClient, safelyCallPlaid } from '../../_shared/plaid-client.ts';
import { decryptAccessToken } from '../../_shared/encryption.ts';

serve(async (req) => {
  if (req.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const jwt = authorization.replace('Bearer ', '');
    const { userId, orgId } = await withOrgFromJWT(jwt);

    const { connectionId } = await req.json();
    if (!connectionId) {
      return new Response(JSON.stringify({ error: 'Connection ID is required' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get connection details with encrypted access token
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select(`
        id,
        org_id,
        provider,
        provider_item_id,
        status,
        connection_secrets!inner(access_token_encrypted)
      `)
      .eq('id', connectionId)
      .eq('org_id', orgId)
      .eq('provider', 'plaid')
      .single();

    if (connectionError || !connection) {
      console.error('Connection not found or access denied:', {
        error: connectionError,
        connectionId,
        orgId,
        userId
      });
      return new Response(JSON.stringify({
        error: 'Connection not found or access denied'
      }), { status: 404 });
    }

    // Check if already disconnected
    if (connection.status === 'disconnected') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Connection already disconnected'
      }), { status: 200 });
    }

    // Decrypt the access token
    const encryptedToken = connection.connection_secrets.access_token_encrypted;
    const accessToken = await decryptAccessToken(encryptedToken);

    // Create Plaid client and revoke the token
    const plaidClient = createPlaidClient();

    await safelyCallPlaid(async () => {
      const response = await fetch(`${plaidClient.baseUrl}/item/remove`, {
        method: 'POST',
        headers: plaidClient.headers,
        body: JSON.stringify({
          access_token: accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Plaid item removal failed: ${JSON.stringify(errorData)}`);
      }

      return response.json();
    }, 'item_remove');

    // Begin database transaction to update connection and clean up secrets
    const { error: updateError } = await supabase.rpc('disconnect_connection', {
      p_connection_id: connectionId,
      p_org_id: orgId,
      p_user_id: userId
    });

    if (updateError) {
      console.error('Failed to update connection status:', {
        error: updateError,
        connectionId,
        orgId,
        userId
      });

      // Log the failed disconnect operation for audit trail
      try {
        await supabase.rpc('log_service_role_operation', {
          p_table_name: 'connections',
          p_operation: 'disconnect_failed',
          p_org_id: orgId,
          p_user_id: userId,
          p_edge_function: 'plaid-disconnect'
        });
      } catch (auditError) {
        console.warn('Failed to log audit entry:', auditError);
      }

      throw new Error(`Failed to disconnect connection: ${updateError.message}`);
    }

    // Remove encrypted access token from secrets table
    const { error: secretsError } = await supabase
      .from('connection_secrets')
      .delete()
      .eq('connection_id', connectionId);

    if (secretsError) {
      console.warn('Failed to remove connection secrets (non-critical):', {
        error: secretsError,
        connectionId
      });
      // Don't fail the request for this - the token is already revoked with Plaid
    }

    // Mark all accounts under this connection as inactive
    const { error: accountsError } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('connection_id', connectionId)
      .eq('org_id', orgId);

    if (accountsError) {
      console.warn('Failed to deactivate accounts (non-critical):', {
        error: accountsError,
        connectionId
      });
      // Don't fail the request for this - main connection is disconnected
    }

    // Log successful disconnect operation for audit trail
    try {
      await supabase.rpc('log_service_role_operation', {
        p_table_name: 'connections',
        p_operation: 'disconnect_success',
        p_org_id: orgId,
        p_user_id: userId,
        p_edge_function: 'plaid-disconnect'
      });
    } catch (auditError) {
      console.warn('Failed to log audit entry:', auditError);
    }

    // Track successful disconnection
    await trackConnection('disconnected', connectionId, 'plaid', orgId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank account disconnected successfully'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Disconnect error:', error);

    // Enhanced error logging with context
    console.error('Full disconnect error context:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      environment: {
        hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        hasServiceRole: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        hasPlaidCredentials: !!Deno.env.get('PLAID_CLIENT_ID') && !!Deno.env.get('PLAID_SECRET')
      }
    });

    await captureException(error as Error, 'error', {
      tags: {
        operation: 'plaid_disconnect',
        error_type: error instanceof Error ? error.name : 'unknown'
      },
      extra: {
        hasRequiredEnvVars: {
          supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
          serviceRole: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          plaidCredentials: !!Deno.env.get('PLAID_CLIENT_ID')
        }
      }
    });

    return new Response(JSON.stringify({
      error: 'Disconnect failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});