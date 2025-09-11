import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

async function verifyWebhookSignature(
  body: string, 
  signature: string, 
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Plaid webhook signature format is typically sha256=<hex>
    const providedHex = signature.replace('sha256=', '');
    
    return expectedHex === providedHex;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    
    // Fail closed in production if webhook secret is missing
    const plaidEnv = Deno.env.get('PLAID_ENV') || Deno.env.get('ENVIRONMENT') || 'development';
    const webhookSecret = Deno.env.get('PLAID_WEBHOOK_SECRET');
    
    if (!webhookSecret && (plaidEnv === 'production' || plaidEnv === 'development')) {
      console.error('PLAID_WEBHOOK_SECRET required in production environment');
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Verify webhook signature if webhook secret is configured
    if (webhookSecret) {
      const signature = req.headers.get('plaid-verification');
      if (!signature || !await verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        // Parse webhook for minimal logging - no payload echo
        try {
          const webhookData = JSON.parse(rawBody);
          console.warn('Invalid webhook signature', {
            webhook_type: webhookData.webhook_type,
            webhook_code: webhookData.webhook_code,
            request_id: webhookData.request_id
          });
        } catch {
          console.warn('Invalid webhook signature - unparseable payload');
        }
        return new Response('Unauthorized', { status: 401 });
      }
    } else {
      console.warn('Webhook signature verification skipped - PLAID_WEBHOOK_SECRET not configured');
    }

    const webhook = JSON.parse(rawBody);
    
    console.log('Plaid webhook received:', webhook.webhook_type, webhook.webhook_code);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (webhook.webhook_type) {
      case 'TRANSACTIONS':
        if (webhook.webhook_code === 'DEFAULT_UPDATE' || 
            webhook.webhook_code === 'HISTORICAL_UPDATE') {
          
          // Find connection by item_id
          const { data: connection } = await supabase
            .from('connections')
            .select('id')
            .eq('provider', 'plaid')
            .eq('provider_item_id', webhook.item_id)
            .single();

          if (connection) {
            // Trigger async sync
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/plaid/sync-transactions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({ connectionId: connection.id }),
            }).catch(console.error); // Fire and forget
          }
        } else if (webhook.webhook_code === 'TRANSACTIONS_REMOVED') {
          // Handle removed transactions
          // Implementation similar to sync but for removal only
        }
        break;

      case 'ITEM':
        if (webhook.webhook_code === 'ERROR') {
          // Mark connection as errored
          await supabase
            .from('connections')
            .update({ status: 'error' })
            .eq('provider', 'plaid')
            .eq('provider_item_id', webhook.item_id);
        }
        break;
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
});