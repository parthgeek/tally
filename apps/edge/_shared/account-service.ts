import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPlaidClient, safelyCallPlaid } from './plaid-client.ts';
import { getConnectionWithSecrets, decryptAccessToken } from './database.ts';

export interface PlaidAccount {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
  mask: string | null;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string;
  };
}

export interface NormalizedAccount {
  org_id: string;
  connection_id: string;
  provider_account_id: string;
  name: string;
  type: string;
  currency: string;
  is_active: boolean;
  current_balance_cents?: string;
  mask?: string | null;
}

export function normalizeAccountType(plaidType: string, plaidSubtype: string): string {
  const typeMap: Record<string, string> = {
    'checking': 'checking',
    'savings': 'savings',
    'credit card': 'credit_card',
    'money market': 'savings',
    'cd': 'savings',
    'ira': 'investment',
    '401k': 'investment',
  };
  
  return typeMap[plaidSubtype] || typeMap[plaidType] || 'other';
}

export function balanceToCents(balance: number | null): string {
  if (balance === null || balance === undefined) return '0';
  // Convert dollars to cents, ensuring we don't lose precision
  return Math.round(balance * 100).toString();
}

export async function fetchPlaidAccounts(accessToken: string): Promise<PlaidAccount[]> {
  const client = createPlaidClient();
  
  return await safelyCallPlaid(
    async () => {
      const response = await fetch(`${client.baseUrl}/accounts/get`, {
        method: 'POST',
        headers: client.headers,
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.accounts;
    },
    'fetchPlaidAccounts'
  );
}

export function transformPlaidAccounts(
  accounts: PlaidAccount[],
  orgId: string,
  connectionId: string
): NormalizedAccount[] {
  return accounts.map(account => ({
    org_id: orgId,
    connection_id: connectionId,
    provider_account_id: account.account_id,
    name: account.name,
    type: normalizeAccountType(account.type, account.subtype),
    currency: account.balances.iso_currency_code || 'USD',
    is_active: true,
    current_balance_cents: balanceToCents(account.balances.current),
    mask: account.mask,
  }));
}

export async function upsertAccounts(accounts: NormalizedAccount[]): Promise<number> {
  if (accounts.length === 0) return 0;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let upsertedCount = 0;

  for (const account of accounts) {
    const { error } = await supabase
      .from('accounts')
      .upsert(account, {
        onConflict: 'org_id,provider_account_id'
      });

      if (error) {
      console.error('Account upsert failed:', {
        org_id: account.org_id,
        connection_id: account.connection_id,
        provider_account_id: account.provider_account_id,
        account_name: account.name,
        account_type: account.type,
        error_code: error.code,
        error_message: error.message,
        error_details: error.details
      });
    } else {
      upsertedCount++;
    }
  }

  return upsertedCount;
}

export async function syncAccountsForConnection(connectionId: string): Promise<{ upserted: number }> {
  // Get connection data
  const connection = await getConnectionWithSecrets(connectionId);
  const accessToken = await decryptAccessToken(connection.access_token_encrypted);

  // Fetch from Plaid
  const plaidAccounts = await fetchPlaidAccounts(accessToken);

  // Transform and store
  const normalizedAccounts = transformPlaidAccounts(
    plaidAccounts,
    connection.org_id,
    connectionId
  );

  const upserted = await upsertAccounts(normalizedAccounts);

  // Log warning if no accounts were upserted
  if (upserted === 0 && normalizedAccounts.length > 0) {
    console.warn('Account sync completed but no accounts were upserted:', {
      connectionId,
      org_id: connection.org_id,
      plaid_accounts_count: plaidAccounts.length,
      normalized_accounts_count: normalizedAccounts.length,
      sample_account: normalizedAccounts[0] || null
    });
  } else if (upserted > 0) {
    console.log('Account sync successful:', {
      connectionId,
      org_id: connection.org_id,
      accounts_upserted: upserted,
      total_accounts: normalizedAccounts.length
    });
  }

  return { upserted };
}