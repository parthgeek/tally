// apps/api/shopify/payouts/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Types for Shopify Payouts
interface ShopifyPayout {
  id: string;
  date: string;
  currency: string;
  amount: string;
  status: string;
  summary: {
    adjustments: { amount: string }[];
    charges: { amount: string }[];
    fees: { amount: string }[];
    refunds: { amount: string }[];
  };
}

interface ShopifyPayoutTransaction {
  id: string;
  type: 'charge' | 'refund' | 'fee' | 'adjustment';
  amount: string;
  fee: string;
  net: string;
  order_id: string | null;
  refund_id: string | null;
  processed_at: string;
}

// Helper functions
function toCents(amount: string | number): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round(num * 100);
}

function calculateTotals(payout: ShopifyPayout) {
  const gross = payout.summary.charges.reduce((sum, charge) => sum + parseFloat(charge.amount || '0'), 0);
  const refunds = payout.summary.refunds.reduce((sum, refund) => sum + parseFloat(refund.amount || '0'), 0);
  const fees = payout.summary.fees.reduce((sum, fee) => sum + parseFloat(fee.amount || '0'), 0);
  const adjustments = payout.summary.adjustments.reduce((sum, adj) => sum + parseFloat(adj.amount || '0'), 0);
  const net = parseFloat(payout.amount);

  return { gross, refunds, fees, adjustments, net };
}

async function fetchShopifyPayouts(shopDomain: string, accessToken: string): Promise<ShopifyPayout[]> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-10/shopify_payments/payouts.json?limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.payouts || [];
}

async function fetchPayoutTransactions(shopDomain: string, accessToken: string, payoutId: string): Promise<ShopifyPayoutTransaction[]> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-10/shopify_payments/payouts/${payoutId}/transactions.json?limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions for payout ${payoutId}: ${response.status}`);
  }
  
  const data = await response.json();
  return data.transactions || [];
}

export async function POST(request: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Fetch all active Shopify connections
    const { data: connections, error: connectionsError } = await supabase
      .from('shopify_connections')
      .select('*')
      .eq('is_active', true);

    if (connectionsError) {
      throw new Error(`Failed to fetch connections: ${connectionsError.message}`);
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Shopify connections found',
        payoutsSynced: 0,
        itemsSynced: 0
      });
    }

    const results = [];

    // 2. Process each Shopify connection
    for (const connection of connections) {
      const connectionResult = {
        shopDomain: connection.shop_domain,
        orgId: connection.org_id,
        payoutsSynced: 0,
        itemsSynced: 0,
        errors: [] as string[]
      };

      try {
        // Fetch payouts from Shopify
        const payouts = await fetchShopifyPayouts(connection.shop_domain, connection.access_token);
        
        for (const payout of payouts) {
          try {
            // Calculate totals from Shopify's summary
            const totals = calculateTotals(payout);

            // Insert/update payout record
            const { data: payoutRecord, error: payoutError } = await supabase
              .from('shopify_payouts')
              .upsert({
                org_id: connection.org_id,
                shop: connection.shop_domain,
                shopify_payout_id: payout.id,
                payout_date: payout.date,
                currency: payout.currency,
                gross_cents: toCents(totals.gross),
                refunds_cents: toCents(totals.refunds),
                fees_cents: toCents(totals.fees + totals.adjustments),
                net_cents: toCents(totals.net),
                status: 'pending', // We'll update this based on payout status
                raw: payout
              }, {
                onConflict: 'org_id,shopify_payout_id'
              })
              .select()
              .single();

            if (payoutError) {
              connectionResult.errors.push(`Payout ${payout.id}: ${payoutError.message}`);
              continue;
            }

            connectionResult.payoutsSynced++;

            // Fetch and process payout transactions (line items)
            const transactions = await fetchPayoutTransactions(
              connection.shop_domain, 
              connection.access_token, 
              payout.id
            );

            for (const transaction of transactions) {
              const itemData = {
                payout_id: payoutRecord.id,
                org_id: connection.org_id,
                item_type: transaction.type,
                amount_cents: toCents(transaction.amount),
                currency: payout.currency,
                shopify_order_id: transaction.order_id,
                shopify_refund_id: transaction.refund_id,
                provider_tx_id: `shopify_${transaction.id}`,
                raw: transaction
              };

              const { error: itemError } = await supabase
                .from('shopify_payout_items')
                .upsert(itemData, {
                  onConflict: 'payout_id,provider_tx_id'
                });

              if (itemError) {
                connectionResult.errors.push(`Transaction ${transaction.id}: ${itemError.message}`);
              } else {
                connectionResult.itemsSynced++;
              }
            }

          } catch (payoutError) {
            connectionResult.errors.push(`Payout ${payout.id}: ${payoutError instanceof Error ? payoutError.message : 'Unknown error'}`);
          }
        }

      } catch (connectionError) {
        connectionResult.errors.push(`Connection error: ${connectionError instanceof Error ? connectionError.message : 'Unknown error'}`);
      }

      results.push(connectionResult);
    }

    // 3. Return clean results
    const totals = results.reduce((acc, result) => ({
      payoutsSynced: acc.payoutsSynced + result.payoutsSynced,
      itemsSynced: acc.itemsSynced + result.itemsSynced,
      totalErrors: acc.totalErrors + result.errors.length
    }), { payoutsSynced: 0, itemsSynced: 0, totalErrors: 0 });

    return NextResponse.json({
      success: true,
      connectionsProcessed: connections.length,
      totals,
      results
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to sync payouts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch payouts with their items
export async function GET(request: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');
  const shop = searchParams.get('shop');

  let query = supabase
    .from('shopify_payouts')
    .select(`
      *,
      shopify_payout_items(*)
    `)
    .order('payout_date', { ascending: false });

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  if (shop) {
    query = query.eq('shop', shop);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    payouts: data,
    total: data?.length || 0
  });
}