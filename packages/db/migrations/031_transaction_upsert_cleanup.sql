-- 031_transaction_upsert_cleanup.sql
-- Cleanup: Remove partial unique index and unused RPC function after constraint is deployed
--
-- IMPORTANT: Only run this AFTER:
-- 1. Migration 030 is applied
-- 2. Application code is deployed with batched upsert using new constraint
-- 3. All edge functions and supabase functions are using the new constraint
-- 4. No 400 errors are being logged from transaction upserts

-- Drop the old partial unique index (now redundant)
DROP INDEX IF EXISTS idx_transactions_org_provider_tx;

-- Drop the RPC function if it exists (was used in apps/edge before batched upsert)
-- Note: Adjust signature if your actual function signature differs
DROP FUNCTION IF EXISTS upsert_transaction(
  uuid, uuid, date, bigint, text, text, text, text, text, jsonb, text, boolean
);

COMMENT ON CONSTRAINT transactions_org_provider_tx_uniq ON transactions IS
'Primary deduplication constraint for transactions. Replaces partial index from migration 004. Enables efficient batched upserts via PostgREST with on_conflict.';

