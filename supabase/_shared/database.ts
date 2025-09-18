import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ConnectionWithSecrets {
  id: string;
  org_id: string;
  access_token_encrypted: string;
  accounts: Array<{
    id: string;
    provider_account_id: string;
  }>;
}

export async function getConnectionWithSecrets(
  connectionId: string
): Promise<ConnectionWithSecrets> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: connection, error } = await supabase
    .from('connections')
    .select(`
      id,
      org_id,
      connection_secrets!inner (access_token_encrypted),
      accounts (id, provider_account_id)
    `)
    .eq('id', connectionId)
    .single();

  if (error || !connection) {
    throw new Error(`Connection ${connectionId} not found or missing secrets`);
  }

  return {
    ...connection,
    access_token_encrypted: connection.connection_secrets.access_token_encrypted,
  };
}

import { decryptAccessTokenWithFallback, decryptAccessTokenStrict } from './encryption.ts';

export async function decryptAccessToken(encryptedToken: string): Promise<string> {
  // In production-like environments, use strict decryption by default
  const environment = Deno.env.get('ENVIRONMENT') || Deno.env.get('PLAID_ENV') || 'development';
  const allowLegacyFallback = Deno.env.get('ALLOW_LEGACY_TOKEN_FALLBACK') === 'true';
  
  if (environment === 'production' && !allowLegacyFallback) {
    return await decryptAccessTokenStrict(encryptedToken);
  }
  
  return await decryptAccessTokenWithFallback(encryptedToken);
}

export async function updatePlaidCursor(
  connectionId: string,
  cursor: string
): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase
    .from('plaid_cursors')
    .upsert({
      connection_id: connectionId,
      cursor,
    });

  if (error) {
    throw new Error(`Failed to update cursor: ${error.message}`);
  }
}

export async function getPlaidCursor(connectionId: string): Promise<string | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: cursorData } = await supabase
    .from('plaid_cursors')
    .select('cursor')
    .eq('connection_id', connectionId)
    .single();

  return cursorData?.cursor || null;
}