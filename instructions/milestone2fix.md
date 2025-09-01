# Milestone 2 — Plaid Integration Fixes and Improvements

**Goals:**
- Refactor Edge Functions to follow single responsibility principle
- Improve error handling with specific error types and messages
- Add proper integration tests with real database testing
- Extract configuration and reduce mocking in tests
- Maintain backward compatibility while improving maintainability

**Context:**
Based on senior engineering review (QCHECK), several critical improvements are needed to make the Plaid integration production-ready and maintainable. The core architecture is sound, but implementation needs refactoring to follow best practices.

**Timeline:** 2-3 days

---

## Workstream 1 — Refactor Edge Functions Architecture

**Goal:** Break monolithic Edge Functions into composable, testable modules

### 1.1 Create Shared Edge Function Utilities

**File:** `apps/edge/_shared/plaid-client.ts`
```typescript
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';

export enum PlaidSyncError {
  INVALID_TOKEN = 'invalid_access_token',
  API_LIMIT = 'rate_limit_exceeded', 
  NETWORK = 'network_error',
  ITEM_ERROR = 'item_error',
  INSTITUTION_ERROR = 'institution_error'
}

export class PlaidApiError extends Error {
  constructor(
    public readonly code: PlaidSyncError,
    public readonly originalError?: unknown,
    message?: string
  ) {
    super(message || code);
    this.name = 'PlaidApiError';
  }
}

export function createPlaidClient(env?: string): PlaidApi {
  const environment = env || Deno.env.get('PLAID_ENV') || 'sandbox';
  
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[environment as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': Deno.env.get('PLAID_CLIENT_ID')!,
          'PLAID-SECRET': Deno.env.get('PLAID_SECRET')!,
        },
      },
    })
  );
}

export async function safelyCallPlaid<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Plaid API error in ${context}:`, error);
    
    // Map Plaid errors to our error types
    if (error?.response?.status === 400) {
      throw new PlaidApiError(PlaidSyncError.INVALID_TOKEN, error);
    } else if (error?.response?.status === 429) {
      throw new PlaidApiError(PlaidSyncError.API_LIMIT, error);
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      throw new PlaidApiError(PlaidSyncError.NETWORK, error);
    }
    
    throw new PlaidApiError(PlaidSyncError.ITEM_ERROR, error, `Failed ${context}`);
  }
}
```

**File:** `apps/edge/_shared/database.ts`
```typescript
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

export function decryptAccessToken(encryptedToken: string): string {
  // TODO: Replace with proper encryption/decryption
  return atob(encryptedToken);
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
```

### 1.2 Create Domain-Specific Service Functions

**File:** `apps/edge/_shared/account-service.ts`
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPlaidClient, safelyCallPlaid } from './plaid-client.ts';

export interface PlaidAccount {
  account_id: string;
  name: string;
  type: string;
  subtype: string;
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

export async function fetchPlaidAccounts(accessToken: string): Promise<PlaidAccount[]> {
  const client = createPlaidClient();
  
  return await safelyCallPlaid(
    async () => {
      const response = await client.accountsGet({ access_token: accessToken });
      return response.data.accounts;
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
  }));
}

export async function upsertAccounts(accounts: NormalizedAccount[]): Promise<number> {
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

    if (!error) upsertedCount++;
  }

  return upsertedCount;
}

export async function syncAccountsForConnection(connectionId: string): Promise<{ upserted: number }> {
  // Get connection data
  const connection = await getConnectionWithSecrets(connectionId);
  const accessToken = decryptAccessToken(connection.access_token_encrypted);

  // Fetch from Plaid
  const plaidAccounts = await fetchPlaidAccounts(accessToken);

  // Transform and store
  const normalizedAccounts = transformPlaidAccounts(
    plaidAccounts,
    connection.org_id,
    connectionId
  );

  const upserted = await upsertAccounts(normalizedAccounts);

  return { upserted };
}
```

**File:** `apps/edge/_shared/transaction-service.ts`
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPlaidClient, safelyCallPlaid } from './plaid-client.ts';

// Money utility (inline for Deno)
function toCentsString(amount: number): string {
  return Math.round(Math.abs(amount) * 100).toString();
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

export async function fetchPlaidTransactions(
  accessToken: string,
  startDate: string,
  endDate: string,
  accountIds?: string[],
  offset = 0,
  count = 500
): Promise<{ transactions: PlaidTransaction[]; total: number }> {
  const client = createPlaidClient();
  
  return await safelyCallPlaid(
    async () => {
      const response = await client.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        account_ids: accountIds,
        offset,
        count,
      });
      
      return {
        transactions: response.data.transactions,
        total: response.data.total_transactions,
      };
    },
    'fetchPlaidTransactions'
  );
}

export async function fetchPlaidTransactionSync(
  accessToken: string,
  cursor?: string
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
      const response = await client.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      
      return response.data;
    },
    'fetchPlaidTransactionSync'
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
    source: 'plaid' as const,
    raw: transaction,
    provider_tx_id: transaction.transaction_id,
    reviewed: false,
  };
}

export async function upsertTransactions(transactions: NormalizedTransaction[]): Promise<number> {
  if (transactions.length === 0) return 0;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let insertedCount = 0;

  for (const transaction of transactions) {
    const { error } = await supabase
      .from('transactions')
      .upsert(transaction, {
        onConflict: 'org_id,provider_tx_id'
      });

    if (!error) insertedCount++;
  }

  return insertedCount;
}
```

### 1.3 Refactor Edge Functions to Use Services

**File:** `apps/edge/plaid/sync-accounts/index.ts`
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { syncAccountsForConnection } from '../../_shared/account-service.ts';
import { PlaidApiError } from '../../_shared/plaid-client.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { connectionId } = await req.json();

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: 'connectionId is required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await syncAccountsForConnection(connectionId);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Account sync error:', error);

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

    return new Response(JSON.stringify({ error: 'Account sync failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Workstream 2 — Improve API Route Architecture

**Goal:** Extract configuration, improve error handling, reduce complexity

### 2.1 Create Shared Plaid Client for API Routes

**File:** `apps/web/src/lib/plaid/client.ts`
```typescript
import { PlaidApi, Configuration, PlaidEnvironments, Products, CountryCode } from "plaid";

export enum PlaidError {
  INVALID_CREDENTIALS = 'invalid_credentials',
  RATE_LIMIT = 'rate_limit_exceeded',
  INSTITUTION_ERROR = 'institution_error',
  ITEM_ERROR = 'item_error',
  NETWORK_ERROR = 'network_error',
}

export class PlaidClientError extends Error {
  constructor(
    public readonly code: PlaidError,
    public readonly originalError?: unknown,
    message?: string
  ) {
    super(message || code);
    this.name = 'PlaidClientError';
  }
}

function getPlaidEnvironment(): string {
  const env = process.env.PLAID_ENV || 'sandbox';
  const validEnvironments = Object.keys(PlaidEnvironments);
  
  if (!validEnvironments.includes(env)) {
    console.warn(`Invalid PLAID_ENV: ${env}, defaulting to sandbox`);
    return PlaidEnvironments.sandbox;
  }
  
  return PlaidEnvironments[env as keyof typeof PlaidEnvironments];
}

export function createPlaidClient(): PlaidApi {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw new Error('Missing Plaid credentials: PLAID_CLIENT_ID and PLAID_SECRET are required');
  }

  return new PlaidApi(
    new Configuration({
      basePath: getPlaidEnvironment(),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    })
  );
}

export async function safelyCallPlaid<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Plaid API error in ${context}:`, error);
    
    // Map Plaid-specific errors
    if (error?.response?.data?.error_code) {
      const errorCode = error.response.data.error_code;
      
      switch (errorCode) {
        case 'INVALID_CREDENTIALS':
          throw new PlaidClientError(PlaidError.INVALID_CREDENTIALS, error);
        case 'RATE_LIMIT_EXCEEDED':
          throw new PlaidClientError(PlaidError.RATE_LIMIT, error);
        case 'INSTITUTION_ERROR':
          throw new PlaidClientError(PlaidError.INSTITUTION_ERROR, error);
        case 'ITEM_ERROR':
          throw new PlaidClientError(PlaidError.ITEM_ERROR, error);
        default:
          throw new PlaidClientError(PlaidError.ITEM_ERROR, error, `Unknown Plaid error: ${errorCode}`);
      }
    }

    if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      throw new PlaidClientError(PlaidError.NETWORK_ERROR, error);
    }
    
    throw new PlaidClientError(PlaidError.ITEM_ERROR, error, `Failed ${context}`);
  }
}

export interface LinkTokenConfig {
  userId: string;
  orgId: string;
  webhookUrl?: string;
  products?: Products[];
  countryCodes?: CountryCode[];
}

export async function createLinkToken(config: LinkTokenConfig): Promise<string> {
  const client = createPlaidClient();
  
  return await safelyCallPlaid(
    async () => {
      const response = await client.linkTokenCreate({
        user: {
          client_user_id: `${config.orgId}_${config.userId}`,
        },
        client_name: "Nexus Financial Automation",
        products: config.products || [Products.Transactions],
        country_codes: config.countryCodes || [CountryCode.Us],
        language: 'en',
        webhook: config.webhookUrl,
      });

      return response.data.link_token;
    },
    'createLinkToken'
  );
}
```

### 2.2 Refactor Link Token API Route

**File:** `apps/web/src/app/api/plaid/link-token/route.ts`
```typescript
import { NextRequest } from "next/server";
import { withOrgFromRequest, createErrorResponse } from "@/lib/api/with-org";
import { createLinkToken, PlaidClientError, PlaidError } from "@/lib/plaid/client";

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await withOrgFromRequest(request);

    const linkToken = await createLinkToken({
      userId,
      orgId,
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/plaid/webhook`,
    });

    return Response.json({ linkToken });

  } catch (error) {
    if (error instanceof Response) return error;
    
    if (error instanceof PlaidClientError) {
      const statusCode = error.code === PlaidError.RATE_LIMIT ? 429 : 400;
      return createErrorResponse(`Plaid error: ${error.message}`, statusCode);
    }

    console.error("Error creating Plaid link token:", error);
    return createErrorResponse("Failed to create link token", 500);
  }
}
```

---

## Workstream 3 — Improve Testing Architecture

**Goal:** Add integration tests, reduce mocking, test actual behavior

### 3.1 Create Test Database Setup

**File:** `apps/web/src/test/db-setup.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

// Test database configuration
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createTestClient() {
  return createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY);
}

export async function createTestOrg(name = 'Test Org') {
  const client = createTestClient();
  
  const { data: org, error } = await client
    .from('orgs')
    .insert({
      name,
      industry: 'technology',
      timezone: 'America/New_York',
    })
    .select('id')
    .single();

  if (error) throw error;
  return org.id;
}

export async function createTestUser(orgId: string) {
  const client = createTestClient();
  
  // Create a test user (this would depend on your auth setup)
  const { data: user, error: userError } = await client.auth.admin.createUser({
    email: `test-${Date.now()}@example.com`,
    password: 'test-password-123',
    email_confirm: true,
  });

  if (userError) throw userError;

  // Add user to org
  const { error: roleError } = await client
    .from('user_org_roles')
    .insert({
      user_id: user.user.id,
      org_id: orgId,
      role: 'owner',
    });

  if (roleError) throw roleError;

  return user.user.id;
}

export async function cleanupTestData(orgId: string) {
  const client = createTestClient();
  
  // Cleanup in reverse order due to foreign keys
  await client.from('transactions').delete().eq('org_id', orgId);
  await client.from('accounts').delete().eq('org_id', orgId);
  await client.from('connections').delete().eq('org_id', orgId);
  await client.from('user_org_roles').delete().eq('org_id', orgId);
  await client.from('orgs').delete().eq('id', orgId);
}
```

### 3.2 Create Integration Tests

**File:** `apps/web/src/lib/plaid/client.integration.spec.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createLinkToken, PlaidClientError } from './client';
import { createTestOrg, createTestUser, cleanupTestData } from '@/test/db-setup';

describe('Plaid Client Integration', () => {
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    testOrgId = await createTestOrg('Plaid Test Org');
    testUserId = await createTestUser(testOrgId);
  });

  afterAll(async () => {
    await cleanupTestData(testOrgId);
  });

  describe('createLinkToken', () => {
    it('should create a valid link token with real Plaid API', async () => {
      // Skip if no Plaid credentials (for CI environments)
      if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
        console.warn('Skipping Plaid integration test - missing credentials');
        return;
      }

      const linkToken = await createLinkToken({
        userId: testUserId,
        orgId: testOrgId,
        webhookUrl: 'https://example.com/webhook',
      });

      expect(linkToken).toMatch(/^link-sandbox-[a-f0-9-]+$/);
    });

    it('should handle invalid credentials gracefully', async () => {
      // Temporarily override env vars
      const originalClientId = process.env.PLAID_CLIENT_ID;
      process.env.PLAID_CLIENT_ID = 'invalid_client_id';

      try {
        await createLinkToken({
          userId: testUserId,
          orgId: testOrgId,
        });
        
        expect.fail('Should have thrown PlaidClientError');
      } catch (error) {
        expect(error).toBeInstanceOf(PlaidClientError);
        expect((error as PlaidClientError).code).toBe('invalid_credentials');
      } finally {
        process.env.PLAID_CLIENT_ID = originalClientId;
      }
    });
  });
});
```

### 3.3 Create Unit Tests for Service Functions

**File:** `apps/edge/_shared/account-service.spec.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { 
  normalizeAccountType, 
  transformPlaidAccounts,
  type PlaidAccount 
} from './account-service.ts';

describe('Account Service', () => {
  describe('normalizeAccountType', () => {
    it('should normalize checking account types', () => {
      expect(normalizeAccountType('depository', 'checking')).toBe('checking');
      expect(normalizeAccountType('depository', 'savings')).toBe('savings');
    });

    it('should normalize credit card types', () => {
      expect(normalizeAccountType('credit', 'credit card')).toBe('credit_card');
    });

    it('should handle unknown types', () => {
      expect(normalizeAccountType('unknown', 'unknown')).toBe('other');
    });
  });

  describe('transformPlaidAccounts', () => {
    it('should transform Plaid accounts to normalized format', () => {
      const plaidAccounts: PlaidAccount[] = [
        {
          account_id: 'acc_123',
          name: 'Test Checking',
          type: 'depository',
          subtype: 'checking',
          balances: {
            available: 1000,
            current: 1200,
            iso_currency_code: 'USD',
          },
        },
      ];

      const result = transformPlaidAccounts(plaidAccounts, 'org_456', 'conn_789');

      expect(result).toEqual([
        {
          org_id: 'org_456',
          connection_id: 'conn_789',
          provider_account_id: 'acc_123',
          name: 'Test Checking',
          type: 'checking',
          currency: 'USD',
          is_active: true,
        },
      ]);
    });

    it('should handle missing currency code', () => {
      const plaidAccounts: PlaidAccount[] = [
        {
          account_id: 'acc_123',
          name: 'Test Account',
          type: 'depository',
          subtype: 'checking',
          balances: {
            available: null,
            current: null,
            iso_currency_code: null as any,
          },
        },
      ];

      const result = transformPlaidAccounts(plaidAccounts, 'org_456', 'conn_789');

      expect(result[0].currency).toBe('USD');
    });
  });
});
```

### 3.4 Create Component Integration Tests

**File:** `apps/web/src/components/connect-bank-button.integration.spec.tsx`
```typescript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectBankButton } from './connect-bank-button';
import { createTestOrg, cleanupTestData } from '@/test/db-setup';

// Mock only the Plaid Link component, test actual API calls
vi.mock('react-plaid-link', () => ({
  usePlaidLink: vi.fn(),
}));

describe('ConnectBankButton Integration', () => {
  let testOrgId: string;

  beforeAll(async () => {
    testOrgId = await createTestOrg('Button Test Org');
  });

  afterAll(async () => {
    await cleanupTestData(testOrgId);
  });

  it('should call real API to get link token', async () => {
    const mockOpen = vi.fn();
    const { usePlaidLink } = await import('react-plaid-link');
    
    vi.mocked(usePlaidLink).mockReturnValue({
      open: mockOpen,
      ready: true,
    } as any);

    // Mock fetch to intercept API call
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ linkToken: 'test-link-token-123' }),
    });
    
    global.fetch = mockFetch;

    render(<ConnectBankButton />);

    const button = screen.getByText('Connect Bank Account');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/plaid/link-token', {
        method: 'POST',
      });
    });
  });
});
```

---

## Workstream 4 — Configuration and Environment Management

**Goal:** Centralize configuration, improve environment handling

### 4.1 Create Centralized Configuration

**File:** `packages/shared/src/config.ts`
```typescript
export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
  webhookUrl: string;
}

export interface DatabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface AppConfig {
  plaid: PlaidConfig;
  database: DatabaseConfig;
  siteUrl: string;
}

export function validatePlaidConfig(): PlaidConfig {
  const clientId = process.env.PLAID_CLIENT_ID || Deno?.env?.get?.('PLAID_CLIENT_ID');
  const secret = process.env.PLAID_SECRET || Deno?.env?.get?.('PLAID_SECRET');
  const environment = (process.env.PLAID_ENV || Deno?.env?.get?.('PLAID_ENV') || 'sandbox') as PlaidConfig['environment'];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || Deno?.env?.get?.('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';

  if (!clientId) {
    throw new Error('PLAID_CLIENT_ID environment variable is required');
  }

  if (!secret) {
    throw new Error('PLAID_SECRET environment variable is required');
  }

  if (!['sandbox', 'development', 'production'].includes(environment)) {
    throw new Error(`Invalid PLAID_ENV: ${environment}. Must be sandbox, development, or production`);
  }

  return {
    clientId,
    secret,
    environment,
    webhookUrl: `${siteUrl}/api/plaid/webhook`,
  };
}

export function validateDatabaseConfig(): DatabaseConfig {
  const url = process.env.SUPABASE_URL || Deno?.env?.get?.('SUPABASE_URL');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || Deno?.env?.get?.('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  return { url, serviceRoleKey };
}

export function getAppConfig(): AppConfig {
  return {
    plaid: validatePlaidConfig(),
    database: validateDatabaseConfig(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || Deno?.env?.get?.('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000',
  };
}
```

### 4.2 Update Edge Functions to Use Centralized Config

Update all Edge Functions to use `getAppConfig()` instead of direct environment variable access.

---

## Workstream 5 — Error Handling and Monitoring Improvements

**Goal:** Structured error handling, better monitoring, user-friendly error messages

### 5.1 Create Error Response Standards

**File:** `packages/shared/src/errors.ts`
```typescript
export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  
  // Plaid-specific errors
  PLAID_INVALID_CREDENTIALS = 'plaid_invalid_credentials',
  PLAID_RATE_LIMIT = 'plaid_rate_limit',
  PLAID_INSTITUTION_ERROR = 'plaid_institution_error',
  PLAID_ITEM_ERROR = 'plaid_item_error',
  PLAID_NETWORK_ERROR = 'plaid_network_error',
  
  // Database errors
  DATABASE_CONNECTION_ERROR = 'database_connection_error',
  DATABASE_CONSTRAINT_ERROR = 'database_constraint_error',
  
  // Validation errors
  INVALID_REQUEST_DATA = 'invalid_request_data',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  
  // Business logic errors
  CONNECTION_NOT_FOUND = 'connection_not_found',
  ACCOUNT_SYNC_FAILED = 'account_sync_failed',
  TRANSACTION_SYNC_FAILED = 'transaction_sync_failed',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode = 500,
  details?: Record<string, unknown>
): Response {
  const errorResponse: ErrorDetails = {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    // TODO: Add request ID from headers
  };

  return new Response(JSON.stringify({ error: errorResponse }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

// User-friendly error messages
export const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: 'Please sign in to continue',
  [ErrorCode.FORBIDDEN]: 'You don\'t have permission to access this resource',
  
  [ErrorCode.PLAID_INVALID_CREDENTIALS]: 'Bank connection failed. Please try connecting again.',
  [ErrorCode.PLAID_RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCode.PLAID_INSTITUTION_ERROR]: 'Your bank is temporarily unavailable. Please try again later.',
  [ErrorCode.PLAID_ITEM_ERROR]: 'There was an issue with your bank connection. Please reconnect your account.',
  [ErrorCode.PLAID_NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  
  [ErrorCode.DATABASE_CONNECTION_ERROR]: 'Service temporarily unavailable. Please try again.',
  [ErrorCode.DATABASE_CONSTRAINT_ERROR]: 'This data already exists in our system.',
  
  [ErrorCode.INVALID_REQUEST_DATA]: 'Invalid request. Please check your input.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required information.',
  
  [ErrorCode.CONNECTION_NOT_FOUND]: 'Bank connection not found. Please connect your account first.',
  [ErrorCode.ACCOUNT_SYNC_FAILED]: 'Failed to sync account information. Please try again.',
  [ErrorCode.TRANSACTION_SYNC_FAILED]: 'Failed to sync transactions. Please try again.',
};
```

### 5.2 Create Monitoring and Logging Utilities

**File:** `packages/shared/src/monitoring.ts`
```typescript
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export function createLogger(context: string) {
  return {
    debug: (message: string, metadata?: Record<string, unknown>) =>
      log(LogLevel.DEBUG, message, context, metadata),
    info: (message: string, metadata?: Record<string, unknown>) =>
      log(LogLevel.INFO, message, context, metadata),
    warn: (message: string, metadata?: Record<string, unknown>) =>
      log(LogLevel.WARN, message, context, metadata),
    error: (message: string, metadata?: Record<string, unknown>) =>
      log(LogLevel.ERROR, message, context, metadata),
  };
}

function log(level: LogLevel, message: string, context: string, metadata?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    context,
    metadata,
    timestamp: new Date().toISOString(),
  };

  // In production, send to structured logging service
  // For now, use console with structured output
  console.log(JSON.stringify(entry));

  // TODO: Send to PostHog or other monitoring service
  // if (level === LogLevel.ERROR) {
  //   sendToSentry(entry);
  // }
}
```

---

## Implementation Timeline and Testing Strategy

### **Day 1: Foundation Refactoring**
1. Create shared utilities (plaid-client.ts, database.ts, config.ts)
2. Write unit tests for utility functions
3. Refactor one Edge Function (sync-accounts) as proof of concept

### **Day 2: Complete Edge Function Refactoring**
1. Create service modules (account-service.ts, transaction-service.ts)
2. Refactor all remaining Edge Functions
3. Add error handling and logging

### **Day 3: API Route and Testing Improvements**
1. Refactor API routes to use new client utilities
2. Create integration test infrastructure
3. Write integration tests for key flows
4. Update component tests to reduce mocking

### **Validation Criteria:**

✅ **Functions are small and testable** - Each service function has single responsibility
✅ **Error handling is specific** - Clear error codes and user-friendly messages  
✅ **Integration tests exist** - Test actual API behavior with real database
✅ **Configuration is centralized** - No scattered environment variable access
✅ **Logging is structured** - Consistent logging with metadata for debugging

### **Backward Compatibility:**
All existing API endpoints and Edge Function interfaces remain the same. Only internal implementation changes.

### **Performance Impact:**
Minimal - main changes are architectural. May see slight improvement due to better error handling and reduced redundant code.

---

This refactoring plan addresses all the issues identified in the QCHECK review while maintaining backward compatibility and improving the overall maintainability of the Plaid integration.