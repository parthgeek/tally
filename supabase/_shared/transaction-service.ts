import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPlaidClient, safelyCallPlaid } from './plaid-client.ts';
import { getConnectionWithSecrets, decryptAccessToken } from './database.ts';

export interface SyncResult {
  inserted: number;
  updated: number;
  removed: number;
  hasMore: boolean;
}

export interface BackfillResult {
  inserted: number;
  updated: number;
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category?: string[];
  category_id?: string;
  iso_currency_code: string;
  account_owner?: string;
}

export interface NormalizedTransaction {
  org_id: string;
  account_id: string;
  date: string;
  amount_cents: string;
  currency: string;
  description: string;
  merchant_name: string | null;
  mcc: string | null;
  source: 'plaid';
  raw: PlaidTransaction;
  provider_tx_id: string;
  reviewed: boolean;
}

export function toCentsString(amount: number): string {
  return Math.round(Math.abs(amount) * 100).toString();
}

export async function fetchPlaidTransactionsSync(
  accessToken: string, 
  cursor?: string | null
): Promise<{
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: PlaidTransaction[];
  next_cursor: string;
  has_more: boolean;
}> {
  const client = createPlaidClient();
  
  return await safelyCallPlaid(
    async () => {
      const response = await fetch(`${client.baseUrl}/transactions/sync`, {
        method: 'POST',
        headers: client.headers,
        body: JSON.stringify({
          access_token: accessToken,
          cursor: cursor || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    },
    'fetchPlaidTransactionsSync'
  );
}

export async function fetchPlaidTransactionsGet(
  accessToken: string,
  startDate: string,
  endDate: string,
  accountIds: string[],
  offset = 0,
  count = 500
): Promise<{
  transactions: PlaidTransaction[];
  total_transactions: number;
}> {
  const client = createPlaidClient();
  
  return await safelyCallPlaid(
    async () => {
      const response = await fetch(`${client.baseUrl}/transactions/get`, {
        method: 'POST',
        headers: client.headers,
        body: JSON.stringify({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          account_ids: accountIds,
          offset,
          count,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    },
    'fetchPlaidTransactionsGet'
  );
}

export function transformPlaidTransaction(
  transaction: PlaidTransaction,
  orgId: string,
  accountId: string
): NormalizedTransaction {
  return {
    org_id: orgId,
    account_id: accountId,
    date: transaction.date,
    amount_cents: toCentsString(transaction.amount),
    currency: transaction.iso_currency_code || 'USD',
    description: transaction.name,
    merchant_name: transaction.merchant_name || null,
    mcc: transaction.category_id || null,
    source: 'plaid',
    raw: transaction,
    provider_tx_id: transaction.transaction_id,
    reviewed: false,
  };
}

export async function insertTransactions(transactions: NormalizedTransaction[]): Promise<number> {
  if (transactions.length === 0) return 0;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let insertedCount = 0;

  for (const transaction of transactions) {
    const { error } = await supabase
      .from('transactions')
      .insert(transaction);

    if (!error) insertedCount++;
  }

  return insertedCount;
}

export async function upsertTransactions(transactions: NormalizedTransaction[]): Promise<number> {
  if (transactions.length === 0) return 0;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Batch size for upserts to balance throughput and request size
  const BATCH_SIZE = 500;
  let upsertedCount = 0;

  // Process transactions in batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    const { error, count } = await supabase
      .from('transactions')
      .upsert(batch, {
        onConflict: 'org_id,provider_tx_id',
        count: 'exact'
      });

    if (error) {
      console.error(`Failed to upsert batch ${i / BATCH_SIZE + 1}:`, error);
      // Continue with next batch rather than failing completely
    } else {
      upsertedCount += count || batch.length;
    }
  }

  return upsertedCount;
}

export async function updateTransactions(
  transactions: PlaidTransaction[],
  orgId: string
): Promise<number> {
  if (transactions.length === 0) return 0;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let updatedCount = 0;

  for (const transaction of transactions) {
    const { error } = await supabase
      .from('transactions')
      .update({
        date: transaction.date,
        amount_cents: toCentsString(transaction.amount),
        description: transaction.name,
        merchant_name: transaction.merchant_name || null,
        raw: transaction,
      })
      .eq('provider_tx_id', transaction.transaction_id)
      .eq('org_id', orgId);

    if (!error) updatedCount++;
  }

  return updatedCount;
}

export async function markTransactionsRemoved(
  removedTransactions: PlaidTransaction[],
  orgId: string
): Promise<number> {
  if (removedTransactions.length === 0) return 0;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let removedCount = 0;

  for (const transaction of removedTransactions) {
    const { error } = await supabase
      .from('transactions')
      .update({ raw: { ...transaction, _deleted: true } })
      .eq('provider_tx_id', transaction.transaction_id)
      .eq('org_id', orgId);

    if (!error) removedCount++;
  }

  return removedCount;
}

export async function getCursor(connectionId: string): Promise<string | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data } = await supabase
    .from('plaid_cursors')
    .select('cursor')
    .eq('connection_id', connectionId)
    .single();

  return data?.cursor || null;
}

export async function updateCursor(connectionId: string, cursor: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  await supabase
    .from('plaid_cursors')
    .upsert({
      connection_id: connectionId,
      cursor,
    });
}

export async function syncTransactionsForConnection(connectionId: string): Promise<SyncResult> {
  const connection = await getConnectionWithSecrets(connectionId);
  const accessToken = await decryptAccessToken(connection.access_token_encrypted);
  
  const cursor = await getCursor(connectionId);
  const syncData = await fetchPlaidTransactionsSync(accessToken, cursor);
  
  let inserted = 0;
  let updated = 0;
  let removed = 0;

  // Process added transactions
  if (syncData.added.length > 0) {
    const addedTransactions: NormalizedTransaction[] = [];
    
    for (const transaction of syncData.added) {
      const accountMapping = connection.accounts.find(
        a => a.provider_account_id === transaction.account_id
      );
      
      if (accountMapping) {
        addedTransactions.push(transformPlaidTransaction(
          transaction, 
          connection.org_id, 
          accountMapping.id
        ));
      }
    }
    
    inserted = await insertTransactions(addedTransactions);
  }

  // Process modified transactions
  if (syncData.modified.length > 0) {
    updated = await updateTransactions(syncData.modified, connection.org_id);
  }

  // Process removed transactions
  if (syncData.removed.length > 0) {
    removed = await markTransactionsRemoved(syncData.removed, connection.org_id);
  }

  // Update cursor
  await updateCursor(connectionId, syncData.next_cursor);

  return {
    inserted,
    updated,
    removed,
    hasMore: syncData.has_more,
  };
}

export async function backfillTransactionsForConnection(
  connectionId: string,
  startDays = 90
): Promise<BackfillResult> {
  const connection = await getConnectionWithSecrets(connectionId);
  const accessToken = await decryptAccessToken(connection.access_token_encrypted);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - startDays);
  const endDate = new Date();
  
  let inserted = 0;
  let updated = 0;

  // Process each account separately
  for (const account of connection.accounts) {
    let hasMore = true;
    let offset = 0;
    const count = 500;

    while (hasMore) {
      const transactionData = await fetchPlaidTransactionsGet(
        accessToken,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        [account.provider_account_id],
        offset,
        count
      );

      const normalizedTransactions = transactionData.transactions.map(transaction =>
        transformPlaidTransaction(transaction, connection.org_id, account.id)
      );

      const upserted = await upsertTransactions(normalizedTransactions);
      inserted += upserted;

      offset += count;
      hasMore = offset < transactionData.total_transactions;
    }
  }

  return { inserted, updated };
}