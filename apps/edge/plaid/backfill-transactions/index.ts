import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { backfillTransactionsForConnection } from '../../_shared/transaction-service.ts';
import { PlaidApiError } from '../../_shared/plaid-client.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { connectionId, startDays = 90 } = await req.json();

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: 'connectionId is required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await backfillTransactionsForConnection(connectionId, startDays);

    // If we inserted new transactions, trigger categorization for this org
    if (result.inserted > 0 && result.orgId) {
      try {
        console.log(`Triggering categorization for ${result.inserted} backfilled transactions for org ${result.orgId}`);

        const categorizationResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/jobs-categorize-queue`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ 
              orgId: result.orgId,
              maxBatches: 10  // Process up to 10 batches (100 transactions) immediately
            }),
          }
        );

        if (categorizationResponse.ok) {
          const categorizationResult = await categorizationResponse.json();
          console.log('Categorization triggered successfully:', categorizationResult);
        } else {
          console.error('Failed to trigger categorization:', categorizationResponse.status, categorizationResponse.statusText);
        }
      } catch (categorizationError) {
        console.error('Error triggering categorization:', categorizationError);
        // Don't fail the backfill if categorization fails
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill error:', error);

    if (error instanceof PlaidApiError) {
      return new Response(JSON.stringify({ 
        error: 'Plaid API error',
        code: error.code,
        message: error.message 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Backfill failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});