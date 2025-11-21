import { NextRequest, NextResponse } from 'next/server';

// Types
interface ShopifyConnection {
  id: string;
  org_id: string; // Required: org_id must exist on shopify_connections
  shop_domain: string;
  access_token: string;
  scope: string;
  is_active: boolean;
  last_synced_at: string | null;
  installed_at: string;
  created_at: string;
  updated_at: string;
  auth_id: string;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  currency: string;
  financial_status: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items?: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  refunds?: Array<{
    id: number;
    created_at: string;
    order_id: number;
    transactions?: Array<{
      id: number;
      amount: string;
      kind: string;
      created_at: string;
    }>;
  }>;
  transactions?: Array<{
    id: number;
    order_id: number;
    kind: string;
    gateway: string;
    status: string;
    amount: string;
    currency: string;
    created_at: string;
    fee: string | null;
    processed_at: string;
  }>;
}

interface Transaction {
  id: string;
  org_id: string;
  account_id: string;
  date: string;
  amount_cents: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  mcc: string | null;
  raw: string;
  category_id: string;
  confidence: string;
  source: string;
  receipt_id: string | null;
  reviewed: boolean;
  created_at: string;
  needs_review: boolean;
  normalized_vendor: string | null;
  updated_at: string;
  provider_tx_id: string;
  attributes: string;
}

// Category IDs from your categories table
const CATEGORY_IDS = {
  SALES: '550e8400-e29b-41d4-a716-446655440101', // Product Sales
  FEES: '550e8400-e29b-41d4-a716-446655440301', // Payment Processing Fees
  REFUNDS: '550e8400-e29b-41d4-a716-446655440105', // Refunds (Contra-Revenue)
  TAXES: '550e8400-e29b-41d4-a716-446655440401', // Sales Tax Payable
};

// Logging Helper
function log(level: 'info' | 'warn' | 'error', message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (level === 'error') {
    console.error(logMessage, meta || '');
  } else if (level === 'warn') {
    console.warn(logMessage, meta || '');
  } else {
    console.log(logMessage, meta || '');
  }
}

// Helper Functions
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toCents(amount: string | number): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round(num * 100);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toISOString().split('T')[0];
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// Database Functions
async function getActiveShopifyConnections(): Promise<ShopifyConnection[]> {
  log('info', 'Fetching active Shopify connections from database');
  
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();
  const { data, error } = await supabase
    .from('shopify_connections')
    .select('*')
    .eq('is_active', true);

  const duration = Date.now() - startTime;

  if (error) {
    log('error', 'Failed to fetch Shopify connections', { error: error.message, duration });
    throw new Error(`Failed to fetch Shopify connections: ${error.message}`);
  }

  log('info', `Successfully fetched ${data?.length || 0} active Shopify connection(s)`, { duration, count: data?.length });
  return data || [];
}

async function updateLastSyncedAt(connectionId: string): Promise<void> {
  log('info', `Updating last_synced_at for connection ${connectionId}`);
  
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();
  const { error } = await supabase
    .from('shopify_connections')
    .update({ 
      last_synced_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp()
    })
    .eq('id', connectionId);

  const duration = Date.now() - startTime;

  if (error) {
    log('error', `Failed to update last_synced_at for connection ${connectionId}`, { error: error.message, duration });
  } else {
    log('info', `Successfully updated last_synced_at for connection ${connectionId}`, { duration });
  }
}

async function saveTransactionsToDatabase(transactions: Transaction[]): Promise<void> {
  log('info', `Saving ${transactions.length} transactions to database`);
  
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();
  
  // Get all provider_tx_ids to check for existing transactions
  const providerTxIds = transactions.map(t => t.provider_tx_id);
  
  log('info', `Checking for existing transactions`, { count: providerTxIds.length });
  
  const { data: existingTransactions, error: checkError } = await supabase
    .from('transactions')
    .select('provider_tx_id')
    .in('provider_tx_id', providerTxIds);

  if (checkError) {
    log('error', 'Failed to check for existing transactions', { 
      error: checkError.message 
    });
    throw new Error(`Failed to check existing transactions: ${checkError.message}`);
  }

  // Create a Set of existing provider_tx_ids for fast lookup
  const existingIds = new Set(existingTransactions?.map(t => t.provider_tx_id) || []);
  
  // Filter out transactions that already exist
  const newTransactions = transactions.filter(t => !existingIds.has(t.provider_tx_id));
  
  log('info', `Found ${existingIds.size} existing transactions, ${newTransactions.length} new transactions to insert`);

  if (newTransactions.length === 0) {
    log('info', 'No new transactions to insert, all already exist');
    const duration = Date.now() - startTime;
    log('info', `Transaction save completed (no new records)`, { duration });
    return;
  }

  // Insert only new transactions
  const { error } = await supabase
    .from('transactions')
    .insert(newTransactions);

  const duration = Date.now() - startTime;

  if (error) {
    log('error', 'Failed to save transactions to database', { 
      error: error.message, 
      transactionCount: newTransactions.length,
      duration 
    });
    throw new Error(`Database error: ${error.message}`);
  }

  log('info', `Successfully saved ${newTransactions.length} new transactions to database`, { 
    duration,
    skipped: existingIds.size,
    inserted: newTransactions.length
  });
}

// Shopify API Helpers
async function fetchShopifyOrders(
  shopDomain: string,
  accessToken: string,
  sinceId?: number,
  limit: number = 250
): Promise<ShopifyOrder[]> {
  const url = new URL(`https://${shopDomain}/admin/api/2024-10/orders.json`);
  url.searchParams.append('limit', limit.toString());
  url.searchParams.append('status', 'any');
  url.searchParams.append('financial_status', 'any');
  
  if (sinceId) {
    url.searchParams.append('since_id', sinceId.toString());
  }

  log('info', `Fetching orders from Shopify`, { 
    shopDomain, 
    limit, 
    sinceId: sinceId || 'none',
    url: url.toString().replace(accessToken, '[REDACTED]')
  });

  const startTime = Date.now();
  const response = await fetch(url.toString(), {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.text();
    log('error', `Shopify API request failed for ${shopDomain}`, { 
      status: response.status, 
      error,
      duration 
    });
    throw new Error(`Shopify API error for ${shopDomain}: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const orderCount = data.orders?.length || 0;
  
  log('info', `Successfully fetched ${orderCount} orders from Shopify`, { 
    shopDomain, 
    orderCount,
    duration 
  });

  return data.orders || [];
}

async function fetchAllShopifyOrders(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyOrder[]> {
  log('info', `Starting to fetch all orders for ${shopDomain}`);
  
  const allOrders: ShopifyOrder[] = [];
  let sinceId: number | undefined = undefined;
  let hasMore = true;
  let batchCount = 0;

  while (hasMore) {
    batchCount++;
    log('info', `Fetching batch ${batchCount} for ${shopDomain}`, { sinceId });
    
    const orders = await fetchShopifyOrders(shopDomain, accessToken, sinceId, 250);
    
    if (orders.length === 0) {
      log('info', `No more orders found for ${shopDomain} after ${batchCount} batches`);
      hasMore = false;
    } else {
      allOrders.push(...orders);
      sinceId = orders[orders.length - 1].id;
      
      log('info', `Batch ${batchCount} completed`, { 
        ordersInBatch: orders.length,
        totalOrdersSoFar: allOrders.length,
        lastOrderId: sinceId
      });
      
      if (orders.length < 250) {
        log('info', `Reached end of orders for ${shopDomain} (last batch had ${orders.length} orders)`);
        hasMore = false;
      }
    }
  }

  log('info', `Completed fetching all orders for ${shopDomain}`, { 
    totalOrders: allOrders.length,
    totalBatches: batchCount 
  });

  return allOrders;
}

// Transaction Normalization Functions
function normalizeOrderTransaction(
  order: ShopifyOrder,
  orgId: string,
  accountId: string
): Transaction {
  const timestamp = getCurrentTimestamp();
  const customerName = order.customer
    ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
    : 'Unknown Customer';

  log('info', `Creating order transaction for order #${order.order_number}`, {
    orderId: order.id,
    orderNumber: order.order_number,
    totalPrice: order.total_price,
    currency: order.currency,
    hasLineItems: !!order.line_items,
    lineItemCount: order.line_items?.length || 0
  });

  return {
    id: generateUUID(),
    org_id: orgId,
    account_id: accountId,
    date: formatDate(order.created_at),
    amount_cents: -toCents(order.total_price), // Negative for income
    currency: order.currency,
    description: `Shopify Order #${order.order_number}`,
    merchant_name: customerName,
    mcc: null,
    raw: {
      order_id: order.id,
      order_number: order.order_number,
      customer: order.customer,
      line_items: order.line_items || [],
      subtotal: order.subtotal_price,
      tax: order.total_tax,
      discounts: order.total_discounts,
      total: order.total_price,
      financial_status: order.financial_status,
      created_at: order.created_at,
      updated_at: order.updated_at,
    },
    category_id: CATEGORY_IDS.SALES,
    confidence: '0.95',
    source: 'shopify',
    receipt_id: null,
    reviewed: false,
    created_at: timestamp,
    needs_review: false,
    normalized_vendor: customerName.toLowerCase(),
    updated_at: timestamp,
    provider_tx_id: `shopify_order_${order.id}`,
    attributes:{
      order_number: order.order_number,
      financial_status: order.financial_status,
      item_count: order.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      customer_email: order.customer?.email || null,
      channel: 'online',
      product_line: 'shopify_store',
    },
  };
}

function normalizeTaxTransaction(
  order: ShopifyOrder,
  orgId: string,
  accountId: string
): Transaction | null {
  const taxAmount = parseFloat(order.total_tax);
  
  if (taxAmount <= 0) {
    log('info', `No tax transaction needed for order #${order.order_number} (tax amount: ${taxAmount})`);
    return null;
  }

  log('info', `Creating tax transaction for order #${order.order_number}`, {
    orderId: order.id,
    taxAmount: order.total_tax,
    currency: order.currency
  });

  const timestamp = getCurrentTimestamp();

  return {
    id: generateUUID(),
    org_id: orgId,
    account_id: accountId,
    date: formatDate(order.created_at),
    amount_cents: toCents(order.total_tax), // Positive for liability
    currency: order.currency,
    description: `Sales Tax - Order #${order.order_number}`,
    merchant_name: 'Tax Authority',
    mcc: null,
    raw: {
      order_id: order.id,
      order_number: order.order_number,
      tax_amount: order.total_tax,
      created_at: order.created_at,
    },
    category_id: CATEGORY_IDS.TAXES,
    confidence: '0.99',
    source: 'shopify',
    receipt_id: null,
    reviewed: false,
    created_at: timestamp,
    needs_review: false,
    normalized_vendor: 'tax authority',
    updated_at: timestamp,
    provider_tx_id: `shopify_tax_${order.id}`,
    attributes: {
      order_number: order.order_number,
      transaction_type: 'sales_tax',
    }
  };
}

function normalizeFeeTransactions(
  order: ShopifyOrder,
  orgId: string,
  accountId: string
): Transaction[] {
  const feeTransactions: Transaction[] = [];
  const timestamp = getCurrentTimestamp();

  // Safety check: order.transactions might be undefined
  if (!order.transactions || !Array.isArray(order.transactions)) {
    log('info', `No transactions found for order #${order.order_number}, skipping fee processing`);
    return feeTransactions;
  }

  log('info', `Processing ${order.transactions.length} transactions for fees in order #${order.order_number}`);

  order.transactions.forEach((transaction) => {
    if (transaction.fee && parseFloat(transaction.fee) > 0) {
      log('info', `Creating fee transaction for order #${order.order_number}`, {
        transactionId: transaction.id,
        gateway: transaction.gateway,
        fee: transaction.fee,
        currency: transaction.currency
      });

      feeTransactions.push({
        id: generateUUID(),
        org_id: orgId,
        account_id: accountId,
        date: formatDate(transaction.created_at),
        amount_cents: toCents(transaction.fee), // Positive for expense
        currency: transaction.currency,
        description: `Payment Processing Fee - Order #${order.order_number}`,
        merchant_name: transaction.gateway,
        mcc: null,
        raw: {
          order_id: order.id,
          order_number: order.order_number,
          transaction_id: transaction.id,
          gateway: transaction.gateway,
          kind: transaction.kind,
          status: transaction.status,
          fee: transaction.fee,
          amount: transaction.amount,
          created_at: transaction.created_at,
        },
        category_id: CATEGORY_IDS.FEES,
        confidence: '0.98',
        source: 'shopify',
        receipt_id: null,
        reviewed: false,
        created_at: timestamp,
        needs_review: false,
        normalized_vendor: transaction.gateway.toLowerCase(),
        updated_at: timestamp,
        provider_tx_id: `shopify_fee_${transaction.id}`,
        attributes: {
          order_number: order.order_number,
          gateway: transaction.gateway,
          transaction_type: 'payment_fee',
          fee_type: 'transaction',
          processor: transaction.gateway,
        },
      });
    }
  });

  log('info', `Created ${feeTransactions.length} fee transaction(s) for order #${order.order_number}`);
  return feeTransactions;
}

function normalizeRefundTransactions(
  order: ShopifyOrder,
  orgId: string,
  accountId: string
): Transaction[] {
  const refundTransactions: Transaction[] = [];
  const timestamp = getCurrentTimestamp();

  // Safety check: order.refunds might be undefined
  if (!order.refunds || !Array.isArray(order.refunds)) {
    log('info', `No refunds found for order #${order.order_number}, skipping refund processing`);
    return refundTransactions;
  }

  log('info', `Processing ${order.refunds.length} refund(s) for order #${order.order_number}`);

  order.refunds.forEach((refund) => {
    // Safety check: refund.transactions might be undefined
    if (!refund.transactions || !Array.isArray(refund.transactions)) {
      log('warn', `Refund ${refund.id} has no transactions array, skipping`);
      return;
    }

    refund.transactions.forEach((transaction) => {
      if (transaction.kind === 'refund' && parseFloat(transaction.amount) > 0) {
        log('info', `Creating refund transaction for order #${order.order_number}`, {
          refundId: refund.id,
          transactionId: transaction.id,
          amount: transaction.amount,
          currency: order.currency
        });

        refundTransactions.push({
          id: generateUUID(),
          org_id: orgId,
          account_id: accountId,
          date: formatDate(transaction.created_at),
          amount_cents: toCents(transaction.amount), // Positive for contra-revenue
          currency: order.currency,
          description: `Refund - Order #${order.order_number}`,
          merchant_name: order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
            : 'Unknown Customer',
          mcc: null,
          raw: {
            order_id: order.id,
            order_number: order.order_number,
            refund_id: refund.id,
            transaction_id: transaction.id,
            amount: transaction.amount,
            kind: transaction.kind,
            created_at: transaction.created_at,
          },
          category_id: CATEGORY_IDS.REFUNDS,
          confidence: '0.97',
          source: 'shopify',
          receipt_id: null,
          reviewed: false,
          created_at: timestamp,
          needs_review: false,
          normalized_vendor: order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.toLowerCase()
            : 'unknown customer',
          updated_at: timestamp,
          provider_tx_id: `shopify_refund_${transaction.id}`,
          attributes: {
            order_number: order.order_number,
            refund_id: refund.id,
            transaction_type: 'refund',
            reason: 'customer_refund',
          },
        });
      }
    });
  });

  log('info', `Created ${refundTransactions.length} refund transaction(s) for order #${order.order_number}`);
  return refundTransactions;
}

function normalizeOrderToTransactions(
  order: ShopifyOrder,
  orgId: string,
  accountId: string
): Transaction[] {
  log('info', `Normalizing order #${order.order_number} to transactions`, {
    orderId: order.id,
    orderNumber: order.order_number,
    totalPrice: order.total_price,
    currency: order.currency
  });

  const transactions: Transaction[] = [];

  // 1. Main order transaction (sale/revenue)
  transactions.push(normalizeOrderTransaction(order, orgId, accountId));

  // 2. Tax transaction
  const taxTx = normalizeTaxTransaction(order, orgId, accountId);
  if (taxTx) {
    transactions.push(taxTx);
  }

  // 3. Fee transactions
  const feeTxs = normalizeFeeTransactions(order, orgId, accountId);
  transactions.push(...feeTxs);

  // 4. Refund transactions
  const refundTxs = normalizeRefundTransactions(order, orgId, accountId);
  transactions.push(...refundTxs);

  log('info', `Normalized order #${order.order_number} into ${transactions.length} transaction(s)`, {
    orderId: order.id,
    breakdown: {
      sales: 1,
      taxes: taxTx ? 1 : 0,
      fees: feeTxs.length,
      refunds: refundTxs.length
    }
  });

  return transactions;
}

// Main Sync Function
async function syncShopifyConnection(connection: ShopifyConnection): Promise<{
  ordersProcessed: number;
  transactionsCreated: number;
  breakdown: { sales: number; taxes: number; fees: number; refunds: number };
}> {
  const syncStartTime = Date.now();
  log('info', `Starting sync for Shopify store: ${connection.shop_domain}`, {
    connectionId: connection.id,
    orgId: connection.org_id,
    lastSyncedAt: connection.last_synced_at
  });

  // Validate org_id exists
  if (!connection.org_id) {
    throw new Error(`Shopify connection ${connection.id} is missing org_id`);
  }

  // Fetch all orders
  const orders = await fetchAllShopifyOrders(
    connection.shop_domain,
    connection.access_token
  );

  log('info', `Fetched ${orders.length} orders from ${connection.shop_domain}`);

  // Normalize orders into transactions
  const allTransactions: Transaction[] = [];
  
  // Use org_id from shopify_connections table
  const orgId = connection.org_id;
  
  // Use connection.id as the account_id (represents the Shopify account)
  const accountId = connection.id;

  log('info', `Normalizing ${orders.length} orders into transactions`, {
    shopDomain: connection.shop_domain,
    orgId,
    accountId
  });

  for (const order of orders) {
    const transactions = normalizeOrderToTransactions(order, orgId, accountId);
    allTransactions.push(...transactions);
  }

  log('info', `Normalized ${allTransactions.length} transactions from ${orders.length} orders`, {
    shopDomain: connection.shop_domain
  });

  // Save to database
  if (allTransactions.length > 0) {
    await saveTransactionsToDatabase(allTransactions);
  } else {
    log('warn', `No transactions to save for ${connection.shop_domain}`);
  }

  // Update last_synced_at
  await updateLastSyncedAt(connection.id);

  const syncDuration = Date.now() - syncStartTime;
  const breakdown = {
    sales: allTransactions.filter((t) => t.category_id === CATEGORY_IDS.SALES).length,
    taxes: allTransactions.filter((t) => t.category_id === CATEGORY_IDS.TAXES).length,
    fees: allTransactions.filter((t) => t.category_id === CATEGORY_IDS.FEES).length,
    refunds: allTransactions.filter((t) => t.category_id === CATEGORY_IDS.REFUNDS).length,
  };

  log('info', `Completed sync for ${connection.shop_domain}`, {
    ordersProcessed: orders.length,
    transactionsCreated: allTransactions.length,
    breakdown,
    duration: syncDuration
  });

  return {
    ordersProcessed: orders.length,
    transactionsCreated: allTransactions.length,
    breakdown,
  };
}

// Main API Handler
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  log('info', '=== Shopify Sync API - POST Request Started ===');

  try {
    log('info', 'Starting Shopify sync for all active connections...');

    // Get all active Shopify connections
    const connections = await getActiveShopifyConnections();

    if (connections.length === 0) {
      log('warn', 'No active Shopify connections found');
      return NextResponse.json({
        success: true,
        message: 'No active Shopify connections found',
        connections: 0,
      });
    }

    log('info', `Found ${connections.length} active Shopify connection(s)`, {
      connections: connections.map(c => ({
        shopDomain: c.shop_domain,
        orgId: c.org_id,
        lastSyncedAt: c.last_synced_at
      }))
    });

    // Sync each connection
    const results = [];
    const errors = [];

    for (const connection of connections) {
      try {
        log('info', `Processing connection: ${connection.shop_domain}`);
        const result = await syncShopifyConnection(connection);
        results.push({
          shopDomain: connection.shop_domain,
          orgId: connection.org_id,
          ...result,
        });
        log('info', `Successfully synced ${connection.shop_domain}`, result);
      } catch (error) {
        log('error', `Error syncing ${connection.shop_domain}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        errors.push({
          shopDomain: connection.shop_domain,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Calculate totals
    const totals = results.reduce(
      (acc, result) => ({
        ordersProcessed: acc.ordersProcessed + result.ordersProcessed,
        transactionsCreated: acc.transactionsCreated + result.transactionsCreated,
        breakdown: {
          sales: acc.breakdown.sales + result.breakdown.sales,
          taxes: acc.breakdown.taxes + result.breakdown.taxes,
          fees: acc.breakdown.fees + result.breakdown.fees,
          refunds: acc.breakdown.refunds + result.breakdown.refunds,
        },
      }),
      {
        ordersProcessed: 0,
        transactionsCreated: 0,
        breakdown: { sales: 0, taxes: 0, fees: 0, refunds: 0 },
      }
    );

    const requestDuration = Date.now() - requestStartTime;

    log('info', '=== Shopify Sync API - POST Request Completed ===', {
      duration: requestDuration,
      connectionsProcessed: connections.length,
      successfulSyncs: results.length,
      failedSyncs: errors.length,
      totals
    });

    return NextResponse.json({
      success: true,
      connectionsProcessed: connections.length,
      successfulSyncs: results.length,
      failedSyncs: errors.length,
      totals,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const requestDuration = Date.now() - requestStartTime;
    log('error', '=== Shopify Sync API - POST Request Failed ===', {
      duration: requestDuration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        error: 'Failed to sync Shopify data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check sync status
export async function GET(request: NextRequest) {
  const requestStartTime = Date.now();
  log('info', '=== Shopify Sync API - GET Request Started ===');

  try {
    const connections = await getActiveShopifyConnections();

    const requestDuration = Date.now() - requestStartTime;
    log('info', '=== Shopify Sync API - GET Request Completed ===', {
      duration: requestDuration,
      activeConnections: connections.length
    });

    return NextResponse.json({
      status: 'ready',
      activeConnections: connections.length,
      connections: connections.map((c) => ({
        shopDomain: c.shop_domain,
        orgId: c.org_id,
        lastSyncedAt: c.last_synced_at,
        installedAt: c.installed_at,
      })),
    });
  } catch (error) {
    const requestDuration = Date.now() - requestStartTime;
    log('error', '=== Shopify Sync API - GET Request Failed ===', {
      duration: requestDuration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch connections',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}