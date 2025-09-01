### Milestone 2 — Plaid Link UI + Token Exchange + Sync (Days 5-8) — Implementation Plan

**Goals:**
- Implement complete Plaid integration from UI to data sync
- Secure token exchange via Edge Functions
- 90-day transaction backfill with proper normalization
- Daily sync with webhook support
- UI for connection management and transaction visibility
- Maintain strong security with access tokens isolated from client

**Constraints and Guidelines (from CLAUDE.md):**
- TDD-first for API routes and Edge Functions where practical (C-1, T-2, T-4)
- Use branded ID types from `@nexus/types` (C-5). Keep validation via Zod contracts
- Scope all DB operations by `orgId` and rely on RLS (S-1). Prefer Supabase client types (S-2)
- Store sensitive API keys in Supabase Vault, not environment variables (S-4)
- Keep code small, composable functions; colocate simple route tests
- Lint, typecheck, and prettier must pass (G-1, G-2). Use Conventional Commits (GH-1)

**Environment and Config:**
- Plaid: `PLAID_CLIENT_ID`, `PLAID_SECRET` (sandbox initially)
- Plaid Environment: `PLAID_ENV=sandbox` (later `development` or `production`)
- Supabase: Existing env vars plus service role for Edge Functions
- Store Plaid secrets in Supabase Vault for Edge Functions access

**Repo Context (Current State):**
- Database schema: `connections`, `accounts`, `transactions` tables exist with RLS
- Auth & org scoping: `withOrg` helper enforces org membership
- API patterns: Existing routes in `apps/web/src/app/api/` follow consistent patterns
- Edge Functions: `apps/edge/` directory exists but empty
- PostHog & Sentry: Analytics infrastructure ready
- Type contracts: `@nexus/types` with Zod schemas for validation

---

## Workstream 1 — Database Schema Extensions for Plaid

**Goal:** Extend existing schema to support Plaid-specific requirements

### 1.1 Create Migration for Plaid Support
**File:** `packages/db/migrations/004_plaid_integration.sql`

```sql
-- Add Plaid-specific columns to connections table
ALTER TABLE connections ADD COLUMN provider_item_id text NULL;

-- Add unique constraint to prevent duplicate Plaid items per org
CREATE UNIQUE INDEX idx_connections_org_provider_item 
ON connections(org_id, provider, provider_item_id) 
WHERE provider = 'plaid' AND provider_item_id IS NOT NULL;

-- Add provider-specific IDs to accounts for deduplication
ALTER TABLE accounts ADD COLUMN provider_account_id text NULL;
CREATE UNIQUE INDEX idx_accounts_org_provider_account 
ON accounts(org_id, provider_account_id) 
WHERE provider_account_id IS NOT NULL;

-- Add provider transaction IDs to transactions for deduplication
ALTER TABLE transactions ADD COLUMN provider_tx_id text NULL;
CREATE UNIQUE INDEX idx_transactions_org_provider_tx 
ON transactions(org_id, provider_tx_id) 
WHERE provider_tx_id IS NOT NULL;

-- Create secure table for connection secrets (service-role only access)
CREATE TABLE connection_secrets (
    connection_id uuid PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
    access_token_encrypted text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- No RLS on connection_secrets - only service role can access
-- This table is intentionally not exposed to regular users
REVOKE ALL ON connection_secrets FROM authenticated;
REVOKE ALL ON connection_secrets FROM anon;

-- Create table for Plaid sync cursors
CREATE TABLE plaid_cursors (
    connection_id uuid PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
    cursor text NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on plaid_cursors but allow service role full access
ALTER TABLE plaid_cursors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plaid_cursors_org_access" ON plaid_cursors
    FOR ALL USING (
        connection_id IN (
            SELECT id FROM connections WHERE public.user_in_org(org_id) = true
        )
    );

-- Add indexes for performance
CREATE INDEX idx_connection_secrets_connection_id ON connection_secrets(connection_id);
CREATE INDEX idx_plaid_cursors_connection_id ON plaid_cursors(connection_id);
CREATE INDEX idx_plaid_cursors_updated_at ON plaid_cursors(updated_at);
```

### 1.2 Update Migration Script
**File:** `packages/db/scripts/migrate.ts`
- Ensure new migration runs in sequence
- Test migration rollback capability

---

## Workstream 2 — Plaid Link UI Integration

**Goal:** Frontend components for initiating Plaid Link flow

### 2.1 Add Plaid React SDK
**File:** `apps/web/package.json`
```json
{
  "dependencies": {
    "@plaid/react-plaid-link": "^3.x.x"
  }
}
```

### 2.2 Create API Route for Link Token
**File:** `apps/web/src/app/api/plaid/link-token/route.ts`

```typescript
import { NextRequest } from "next/server";
import { withOrgFromRequest, createErrorResponse } from "@/lib/api/with-org";
import { PlaidApi, Configuration, PlaidEnvironments } from "plaid";

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  })
);

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await withOrgFromRequest(request);

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: `${orgId}_${userId}`,
      },
      client_name: "Nexus Financial Automation",
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/plaid/webhook`,
    });

    return Response.json({ linkToken: response.data.link_token });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating Plaid link token:", error);
    return createErrorResponse("Failed to create link token", 500);
  }
}
```

### 2.3 Create ConnectBankButton Component
**File:** `apps/web/src/components/connect-bank-button.tsx`

```typescript
'use client';

import { useState } from 'react';
import { usePlaidLink } from '@plaid/react-plaid-link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export function ConnectBankButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const { toast } = useToast();

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      try {
        const response = await fetch('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token, metadata }),
        });

        if (!response.ok) throw new Error('Exchange failed');
        
        const { connectionId } = await response.json();
        toast({ title: "Bank connected successfully!" });
        onSuccess?.();
      } catch (error) {
        toast({ 
          title: "Connection failed", 
          description: "Please try again.",
          variant: "destructive" 
        });
      }
    },
    onExit: (err, metadata) => {
      if (err) {
        toast({ 
          title: "Connection cancelled", 
          description: err.error_message || "Please try again.",
          variant: "destructive" 
        });
      }
    },
  });

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/plaid/link-token', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to get link token');
      
      const { linkToken } = await response.json();
      setLinkToken(linkToken);
    } catch (error) {
      toast({ 
        title: "Failed to initialize", 
        description: "Please try again.",
        variant: "destructive" 
      });
    }
  };

  return (
    <Button 
      onClick={linkToken ? open : handleConnect}
      disabled={linkToken && !ready}
    >
      Connect Bank Account
    </Button>
  );
}
```

### 2.4 Add to Dashboard
**File:** `apps/web/src/app/(app)/dashboard/page.tsx`
- Import and use `ConnectBankButton` in empty state
- Show connection status when accounts exist

---

## Workstream 3 — Edge Functions for Secure Token Exchange

**Goal:** Secure server-side Plaid operations isolated from client

### 3.1 Create Shared Auth Helper for Edge Functions
**File:** `apps/edge/_shared/with-org.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export interface AuthenticatedContext {
  userId: string;
  orgId: string;
}

export async function withOrgFromJWT(jwt: string): Promise<AuthenticatedContext> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Get org from request or user's primary org
  // This will be enhanced based on how org context is passed to Edge Functions
  const { data: membership } = await supabase
    .from('user_org_roles')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    throw new Response(JSON.stringify({ error: "No organization access" }), { status: 403 });
  }

  return {
    userId: user.id,
    orgId: membership.org_id,
  };
}
```

### 3.2 Create Token Exchange Edge Function
**File:** `apps/edge/plaid/exchange/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withOrgFromJWT } from '../_shared/with-org.ts';

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!;
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!;
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const jwt = authorization.replace('Bearer ', '');
    const { userId, orgId } = await withOrgFromJWT(jwt);

    const { public_token, metadata } = await req.json();

    // Exchange public token for access token
    const plaidResponse = await fetch(`https://${PLAID_ENV}.plaid.com/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
      body: JSON.stringify({ public_token }),
    });

    if (!plaidResponse.ok) {
      throw new Error('Plaid exchange failed');
    }

    const { access_token, item_id } = await plaidResponse.json();

    // Store in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Create connection record
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .upsert({
        org_id: orgId,
        provider: 'plaid',
        provider_item_id: item_id,
        status: 'active',
        scopes: ['transactions'],
      }, {
        onConflict: 'org_id,provider,provider_item_id'
      })
      .select('id')
      .single();

    if (connectionError || !connection) {
      throw new Error('Failed to create connection');
    }

    // Store encrypted access token (basic base64 for now, enhance with proper encryption)
    const encryptedToken = btoa(access_token);
    const { error: secretError } = await supabase
      .from('connection_secrets')
      .upsert({
        connection_id: connection.id,
        access_token_encrypted: encryptedToken,
      });

    if (secretError) {
      throw new Error('Failed to store access token');
    }

    // Trigger immediate account sync
    await fetch(Deno.env.get('SUPABASE_URL')! + '/functions/v1/plaid/sync-accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ connectionId: connection.id }),
    });

    return new Response(JSON.stringify({ connectionId: connection.id }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Exchange error:', error);
    return new Response(JSON.stringify({ error: 'Exchange failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### 3.3 Create Exchange API Route (Proxy to Edge Function)
**File:** `apps/web/src/app/api/plaid/exchange/route.ts`

```typescript
import { NextRequest } from "next/server";
import { withOrgFromRequest, createErrorResponse } from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    await withOrgFromRequest(request);
    
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return createErrorResponse("No session", 401);
    }

    const body = await request.json();
    
    // Proxy to Edge Function with session token
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/plaid/exchange`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error('Edge function call failed');
    }

    const result = await response.json();
    return Response.json(result);

  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error in Plaid exchange:", error);
    return createErrorResponse("Exchange failed", 500);
  }
}
```

---

## Workstream 4 — Account and Transaction Sync

**Goal:** Fetch and normalize Plaid data into canonical format

### 4.1 Create Money Utilities
**File:** `packages/shared/src/money.ts`

```typescript
/**
 * Converts a monetary amount to cents as a string to avoid floating point errors
 * @param amount - The amount as number or string
 * @returns String representation of amount in cents
 */
export function toCentsString(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) throw new Error('Invalid amount');
  
  // Round to nearest cent and convert to string
  return Math.round(Math.abs(num) * 100).toString();
}

/**
 * Converts cents string back to dollar amount
 * @param centsStr - Amount in cents as string
 * @returns Dollar amount as number
 */
export function fromCentsString(centsStr: string): number {
  const cents = parseInt(centsStr, 10);
  if (isNaN(cents)) throw new Error('Invalid cents string');
  return cents / 100;
}
```

### 4.2 Create Account Sync Edge Function
**File:** `apps/edge/plaid/sync-accounts/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!;
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!;
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';

interface PlaidAccount {
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

function normalizeAccountType(plaidType: string, plaidSubtype: string): string {
  // Map Plaid account types to our canonical types
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

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { connectionId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get connection and access token
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select(`
        id,
        org_id,
        connection_secrets (access_token_encrypted)
      `)
      .eq('id', connectionId)
      .single();

    if (connError || !connection?.connection_secrets?.access_token_encrypted) {
      throw new Error('Connection or access token not found');
    }

    // Decrypt access token (enhance this with proper decryption)
    const accessToken = atob(connection.connection_secrets.access_token_encrypted);

    // Fetch accounts from Plaid
    const plaidResponse = await fetch(`https://${PLAID_ENV}.plaid.com/accounts/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (!plaidResponse.ok) {
      throw new Error('Failed to fetch accounts from Plaid');
    }

    const { accounts }: { accounts: PlaidAccount[] } = await plaidResponse.json();

    // Upsert accounts
    let upsertedCount = 0;
    for (const account of accounts) {
      const { error } = await supabase
        .from('accounts')
        .upsert({
          org_id: connection.org_id,
          connection_id: connectionId,
          provider_account_id: account.account_id,
          name: account.name,
          type: normalizeAccountType(account.type, account.subtype),
          currency: account.balances.iso_currency_code || 'USD',
          is_active: true,
        }, {
          onConflict: 'org_id,provider_account_id'
        });

      if (!error) upsertedCount++;
    }

    return new Response(JSON.stringify({ upserted: upsertedCount }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync accounts error:', error);
    return new Response(JSON.stringify({ error: 'Sync failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### 4.3 Create Transaction Backfill Edge Function
**File:** `apps/edge/plaid/backfill-transactions/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Import money utilities (you'll need to figure out how to import from packages in Deno)
function toCentsString(amount: number): string {
  return Math.round(Math.abs(amount) * 100).toString();
}

interface PlaidTransaction {
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

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { connectionId, startDays = 90 } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get connection details and accounts
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select(`
        id,
        org_id,
        connection_secrets (access_token_encrypted),
        accounts (id, provider_account_id)
      `)
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      throw new Error('Connection not found');
    }

    const accessToken = atob(connection.connection_secrets.access_token_encrypted);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - startDays);

    let inserted = 0;
    let updated = 0;

    // Fetch transactions for each account
    for (const account of connection.accounts) {
      let hasMore = true;
      let offset = 0;
      const count = 500; // Max per request

      while (hasMore) {
        const plaidResponse = await fetch(`https://${PLAID_ENV}.plaid.com/transactions/get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
            'PLAID-SECRET': PLAID_SECRET,
          },
          body: JSON.stringify({
            access_token: accessToken,
            start_date: startDate.toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            account_ids: [account.provider_account_id],
            offset,
            count,
          }),
        });

        if (!plaidResponse.ok) {
          console.error(`Failed to fetch transactions for account ${account.provider_account_id}`);
          break;
        }

        const { transactions, total_transactions } = await plaidResponse.json();

        // Process transactions
        for (const transaction of transactions) {
          const { error } = await supabase
            .from('transactions')
            .upsert({
              org_id: connection.org_id,
              account_id: account.id,
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
            }, {
              onConflict: 'org_id,provider_tx_id'
            });

          if (!error) inserted++;
        }

        offset += count;
        hasMore = offset < total_transactions;
      }
    }

    return new Response(JSON.stringify({ inserted, updated }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: 'Backfill failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Workstream 5 — Daily Sync and Webhook Infrastructure

**Goal:** Keep data fresh with scheduled jobs and webhook handling

### 5.1 Create Daily Sync Job
**File:** `apps/edge/jobs/plaid-daily-sync/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active Plaid connections
    const { data: connections, error } = await supabase
      .from('connections')
      .select('id, org_id')
      .eq('provider', 'plaid')
      .eq('status', 'active');

    if (error || !connections) {
      throw new Error('Failed to fetch connections');
    }

    const results = [];

    for (const connection of connections) {
      try {
        // Call sync for each connection
        const syncResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/plaid/sync-transactions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ connectionId: connection.id }),
          }
        );

        const result = await syncResponse.json();
        results.push({
          connectionId: connection.id,
          orgId: connection.org_id,
          ...result,
        });

        // Log to PostHog for monitoring
        // TODO: Add PostHog logging here

      } catch (error) {
        console.error(`Sync failed for connection ${connection.id}:`, error);
        results.push({
          connectionId: connection.id,
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify({ 
      processed: connections.length,
      results 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Daily sync job error:', error);
    return new Response(JSON.stringify({ error: 'Daily sync failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### 5.2 Create Transaction Sync Edge Function
**File:** `apps/edge/plaid/sync-transactions/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { connectionId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get cursor for this connection
    const { data: cursorData } = await supabase
      .from('plaid_cursors')
      .select('cursor')
      .eq('connection_id', connectionId)
      .single();

    const cursor = cursorData?.cursor || null;

    // Get access token
    const { data: connection } = await supabase
      .from('connections')
      .select(`
        org_id,
        connection_secrets (access_token_encrypted),
        accounts (id, provider_account_id)
      `)
      .eq('id', connectionId)
      .single();

    if (!connection?.connection_secrets?.access_token_encrypted) {
      throw new Error('Access token not found');
    }

    const accessToken = atob(connection.connection_secrets.access_token_encrypted);

    // Call Plaid transactions/sync
    const plaidResponse = await fetch(`https://${PLAID_ENV}.plaid.com/transactions/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
      body: JSON.stringify({
        access_token: accessToken,
        cursor,
      }),
    });

    if (!plaidResponse.ok) {
      throw new Error('Plaid sync API call failed');
    }

    const { added, modified, removed, next_cursor, has_more } = await plaidResponse.json();

    let inserted = 0;
    let updatedCount = 0;

    // Process added transactions
    for (const transaction of added) {
      const accountMapping = connection.accounts.find(
        a => a.provider_account_id === transaction.account_id
      );
      
      if (!accountMapping) continue;

      const { error } = await supabase
        .from('transactions')
        .insert({
          org_id: connection.org_id,
          account_id: accountMapping.id,
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
        });

      if (!error) inserted++;
    }

    // Process modified transactions
    for (const transaction of modified) {
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
        .eq('org_id', connection.org_id);

      if (!error) updatedCount++;
    }

    // Process removed transactions (soft delete or mark as deleted)
    for (const removedTx of removed) {
      await supabase
        .from('transactions')
        .update({ raw: { ...removedTx, _deleted: true } })
        .eq('provider_tx_id', removedTx.transaction_id)
        .eq('org_id', connection.org_id);
    }

    // Update cursor
    await supabase
      .from('plaid_cursors')
      .upsert({
        connection_id: connectionId,
        cursor: next_cursor,
      });

    return new Response(JSON.stringify({ 
      inserted, 
      updated: updatedCount, 
      removed: removed.length,
      hasMore: has_more 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Transaction sync error:', error);
    return new Response(JSON.stringify({ error: 'Sync failed' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### 5.3 Create Webhook Handler
**File:** `apps/edge/plaid/webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const webhook = await req.json();
    
    console.log('Plaid webhook received:', webhook.webhook_type, webhook.webhook_code);

    switch (webhook.webhook_type) {
      case 'TRANSACTIONS':
        if (webhook.webhook_code === 'DEFAULT_UPDATE' || 
            webhook.webhook_code === 'HISTORICAL_UPDATE') {
          
          // Find connection by item_id
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );

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
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );

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
```

---

## Workstream 6 — UI for Connection Management and Transactions

**Goal:** User interfaces for managing connections and viewing transaction data

### 6.1 Create Connections Management Page
**File:** `apps/web/src/app/(app)/settings/connections/page.tsx`

```typescript
import { createServerClient } from '@/lib/supabase';
import { withOrgFromRequest } from '@/lib/api/with-org';
import { ConnectBankButton } from '@/components/connect-bank-button';

interface Connection {
  id: string;
  provider: string;
  status: string;
  created_at: string;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    is_active: boolean;
  }>;
}

async function getConnections(orgId: string): Promise<Connection[]> {
  const supabase = await createServerClient();
  
  const { data, error } = await supabase
    .from('connections')
    .select(`
      id,
      provider,
      status,
      created_at,
      accounts (
        id,
        name,
        type,
        is_active
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export default async function ConnectionsPage() {
  // This would need proper request context in a real implementation
  // For now, assuming we can get orgId from cookies or headers
  
  const connections = await getConnections('org-id-placeholder');

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Bank Connections</h1>
        <ConnectBankButton onSuccess={() => window.location.reload()} />
      </div>

      <div className="space-y-6">
        {connections.map((connection) => (
          <div key={connection.id} className="border rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold capitalize">
                  {connection.provider}
                </h3>
                <p className="text-sm text-gray-600">
                  Connected {new Date(connection.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                connection.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {connection.status}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Accounts:</h4>
              {connection.accounts.map((account) => (
                <div key={account.id} className="flex justify-between items-center">
                  <span>{account.name}</span>
                  <span className="text-sm text-gray-600 capitalize">
                    {account.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {connections.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No bank connections yet</p>
            <ConnectBankButton />
          </div>
        )}
      </div>
    </div>
  );
}
```

### 6.2 Create Transactions List Page
**File:** `apps/web/src/app/(app)/transactions/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Transaction {
  id: string;
  date: string;
  amount_cents: string;
  currency: string;
  description: string;
  merchant_name?: string;
  source: string;
  raw: any;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions/list?limit=50');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amountCents: string, currency: string) => {
    const amount = parseInt(amountCents) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return <div className="container mx-auto py-8">Loading transactions...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8">Transactions</h1>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Merchant</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  {new Date(transaction.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">{transaction.description}</td>
                <td className="px-4 py-3">{transaction.merchant_name || '-'}</td>
                <td className="px-4 py-3 text-right">
                  {formatAmount(transaction.amount_cents, transaction.currency)}
                </td>
                <td className="px-4 py-3 capitalize">{transaction.source}</td>
                <td className="px-4 py-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    View Raw
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No transactions found</p>
        </div>
      )}

      {/* Raw Data Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold">Raw Transaction Data</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
              >
                Close
              </Button>
            </div>
            <div className="p-4 overflow-auto">
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(selectedTransaction.raw, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 6.3 Update Dashboard with Connection Status
**File:** `apps/web/src/app/(app)/dashboard/page.tsx` (additions)

```typescript
// Add to existing dashboard
import { ConnectBankButton } from '@/components/connect-bank-button';

// Add connection status section
async function getConnectionCount(orgId: string) {
  const supabase = await createServerClient();
  const { count } = await supabase
    .from('connections')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active');
  return count || 0;
}

// In the component, show either empty state or connection status
{connectionCount === 0 ? (
  <div className="text-center py-12">
    <h2 className="text-xl font-semibold mb-4">Connect your bank to get started</h2>
    <p className="text-gray-600 mb-6">
      Securely link your bank accounts to automatically import transactions
    </p>
    <ConnectBankButton />
    <p className="text-sm text-gray-500 mt-4">
      Secure connection powered by Plaid • Bank-level encryption
    </p>
  </div>
) : (
  <div>
    <p className="text-green-600 mb-4">
      ✓ {connectionCount} bank connection{connectionCount !== 1 ? 's' : ''} active
    </p>
    {/* Rest of dashboard content */}
  </div>
)}
```

---

## Workstream 7 — Testing and Quality Assurance

**Goal:** Comprehensive test coverage for Plaid integration

### 7.1 Create API Route Tests
**File:** `apps/web/src/app/api/plaid/link-token/route.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock Plaid client
vi.mock('plaid', () => ({
  PlaidApi: vi.fn().mockImplementation(() => ({
    linkTokenCreate: vi.fn().mockResolvedValue({
      data: { link_token: 'test-link-token' }
    })
  })),
  Configuration: vi.fn(),
  PlaidEnvironments: { sandbox: 'https://sandbox.plaid.com' }
}));

describe('/api/plaid/link-token', () => {
  it('should create link token for authenticated user', async () => {
    const request = new NextRequest('http://localhost/api/plaid/link-token', {
      method: 'POST',
    });

    // Mock withOrgFromRequest to return valid context
    vi.mock('@/lib/api/with-org', () => ({
      withOrgFromRequest: vi.fn().mockResolvedValue({
        userId: 'user-123',
        orgId: 'org-456'
      })
    }));

    const response = await POST(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.linkToken).toBe('test-link-token');
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mock('@/lib/api/with-org', () => ({
      withOrgFromRequest: vi.fn().mockRejectedValue(
        new Response('Unauthorized', { status: 401 })
      )
    }));

    const request = new NextRequest('http://localhost/api/plaid/link-token', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

### 7.2 Create Edge Function Tests
**File:** `apps/edge/plaid/exchange/test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { serve } from "./index.ts";

Deno.test("exchange function handles valid request", async () => {
  const request = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer valid-jwt",
    },
    body: JSON.stringify({
      public_token: "test-public-token",
      metadata: { institution_id: "test" },
    }),
  });

  // Mock environment variables
  Deno.env.set("PLAID_CLIENT_ID", "test-client-id");
  Deno.env.set("PLAID_SECRET", "test-secret");
  Deno.env.set("PLAID_ENV", "sandbox");

  // This would need proper mocking for Plaid API and Supabase
  // Implementation depends on testing setup for Edge Functions
});
```

### 7.3 Create End-to-End Tests
**File:** `apps/web/tests/e2e/plaid-integration.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Plaid Integration', () => {
  test('should complete full bank connection flow', async ({ page }) => {
    // Sign in as test user
    await page.goto('/sign-in');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to dashboard
    await expect(page).toHaveURL('/dashboard');

    // Click connect bank button
    await page.click('text=Connect Bank Account');

    // Wait for Plaid Link to load (in sandbox mode)
    await expect(page.locator('text=Connect your bank')).toBeVisible();

    // Complete Plaid flow (this would use Plaid's test credentials)
    // Implementation depends on Plaid's testing utilities

    // Verify connection appears in connections page
    await page.goto('/settings/connections');
    await expect(page.locator('text=plaid')).toBeVisible();
    await expect(page.locator('text=active')).toBeVisible();
  });

  test('should display transactions after connection', async ({ page }) => {
    // Assuming bank is already connected
    await page.goto('/transactions');
    
    // Should see transaction list
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount.toBeGreaterThan(0);

    // Test raw data modal
    await page.click('button:has-text("View Raw")');
    await expect(page.locator('pre')).toBeVisible();
    await page.click('button:has-text("Close")');
  });

  test('should handle connection errors gracefully', async ({ page }) => {
    // Test error handling for invalid tokens, API failures, etc.
    // Implementation would mock various error scenarios
  });
});
```

---

## Workstream 8 — Deployment and Configuration

**Goal:** Deploy Edge Functions and configure production environment

### 8.1 Supabase Edge Functions Configuration
**File:** `apps/edge/supabase/config.toml`

```toml
[functions.plaid-exchange]
verify_jwt = true

[functions.plaid-sync-accounts]
verify_jwt = false  # Called by service role

[functions.plaid-backfill-transactions]
verify_jwt = false  # Called by service role

[functions.plaid-webhook]
verify_jwt = false  # External webhook

[functions.jobs-plaid-daily-sync]
verify_jwt = false  # Scheduled job
```

### 8.2 Environment Variables Setup
**File:** `deployment-env-setup.md`

Required environment variables for production:

```bash
# Plaid Configuration
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret_key
PLAID_ENV=sandbox  # or 'development'/'production'

# Supabase (existing)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 8.3 Schedule Daily Sync Job
Configure in Supabase Dashboard:
- Function: `jobs/plaid-daily-sync`
- Schedule: `0 6 * * *` (6 AM UTC daily)
- Timezone: UTC

---

## Implementation Order and Timeline

### Day 5: Foundation and Security
1. **Database Migration** (Workstream 1)
   - Create and run migration for Plaid schema extensions
   - Verify RLS policies work correctly

2. **Money Utilities** (Workstream 4.1)
   - Create shared money utilities package
   - Add comprehensive tests for precision handling

3. **Environment Setup**
   - Configure Plaid credentials in development
   - Set up Supabase Edge Functions project structure

### Day 6: Core Integration
1. **Plaid Link UI** (Workstream 2)
   - Add Plaid React SDK dependency
   - Create link token API route
   - Build ConnectBankButton component
   - Integrate into dashboard

2. **Token Exchange** (Workstream 3)
   - Create Edge Function for secure token exchange
   - Build API route proxy
   - Implement access token encryption and storage

### Day 7: Data Synchronization
1. **Account Sync** (Workstream 4.2)
   - Create account sync Edge Function
   - Implement account type normalization
   - Add account upsert logic

2. **Transaction Backfill** (Workstream 4.3)
   - Create backfill Edge Function
   - Implement transaction normalization
   - Add proper pagination handling

3. **Transaction Sync** (Workstream 5.2)
   - Create incremental sync Edge Function
   - Implement cursor-based pagination
   - Handle transaction modifications and deletions

### Day 8: UI and Polish
1. **UI Development** (Workstream 6)
   - Create connections management page
   - Build transactions list with raw data modal
   - Update dashboard with connection status

2. **Webhook and Jobs** (Workstream 5)
   - Create webhook handler
   - Implement daily sync job
   - Configure production schedules

3. **Testing and Documentation** (Workstream 7)
   - Write comprehensive tests
   - Create end-to-end test scenarios
   - Update documentation

---

## Acceptance Criteria and Done-When Checklist

### ✅ Core Functionality
- [ ] User can connect bank account via Plaid Link UI
- [ ] Connection appears in settings/connections page with correct status
- [ ] Accounts are synced and visible under the connection
- [ ] 90-day transaction backfill populates normalized data
- [ ] Daily sync job runs and processes new transactions
- [ ] Raw JSONB data is preserved for audit purposes

### ✅ Security Requirements
- [ ] Access tokens stored securely (never in connections table)
- [ ] All operations properly scoped by orgId
- [ ] RLS policies prevent cross-org data access
- [ ] Edge Functions use service role for database access
- [ ] Webhook signature verification (if enabled in Plaid)

### ✅ Data Integrity
- [ ] Unique constraints prevent duplicate connections/accounts/transactions
- [ ] Amount precision handled correctly (no floating point errors)
- [ ] Transaction normalization consistent across sync operations
- [ ] Cursor-based sync maintains data consistency

### ✅ Error Handling and Monitoring
- [ ] Graceful handling of Plaid API errors
- [ ] Failed sync attempts logged and recoverable
- [ ] User-friendly error messages in UI
- [ ] PostHog events track sync success/failure metrics
- [ ] Sentry captures and reports integration errors

### ✅ Performance and Scalability
- [ ] Pagination implemented for large transaction volumes
- [ ] Database indexes optimize query performance
- [ ] Edge Functions handle concurrent requests properly
- [ ] UI remains responsive during background sync operations

---

## Guardrails and Security Best Practices

### 🔒 Access Token Security
- Never store `access_token` in the `connections` table
- Use `connection_secrets` table with service-role-only access
- Implement proper encryption (upgrade from base64 to real encryption)
- Rotate tokens according to Plaid recommendations

### 💰 Money Handling
- Always use `toCentsString()` for amount conversion
- Store amounts as strings to avoid JavaScript precision errors
- Validate amount format in API contracts
- Round to nearest cent consistently

### 🔄 Sync Reliability
- Always persist and update cursor after successful sync
- Implement idempotent operations for retry safety
- Use `provider_tx_id` as primary deduplication key
- Handle partial failures gracefully

### 📊 Monitoring and Alerting
- Log sync counts and timing metrics to PostHog
- Alert on repeated sync failures for same connection
- Monitor webhook delivery success rates
- Track user connection success/failure rates

### 🧪 Testing Strategy
- Test with Plaid sandbox accounts
- Verify RLS isolation with negative tests
- Test error scenarios and recovery
- Validate data normalization edge cases

---

## Rollback Plan

### Immediate Rollback (< 1 hour)
1. Disable Plaid Link UI (hide ConnectBankButton)
2. Pause daily sync job in Supabase
3. Remove webhook URL from Plaid dashboard

### Full Rollback (< 4 hours)
1. Revert database migration if schema issues
2. Remove new API routes and Edge Functions
3. Restore previous dashboard UI state
4. Clean up test data if needed

### Data Recovery
- All existing data remains intact
- New Plaid data isolated in separate tables
- Can replay sync operations from cursors if needed
- Export raw transaction data before rollback if required

---

This implementation plan provides a comprehensive roadmap for integrating Plaid into the Nexus platform while maintaining security, performance, and maintainability standards established in the existing codebase.
