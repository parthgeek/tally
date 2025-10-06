-- 030_transaction_upsert_constraint.sql
-- Replaces partial unique index with full UNIQUE constraint for PostgREST compatibility
-- Fixes: 400 errors on transaction upserts with on_conflict=org_id,provider_tx_id
--
-- Context: PostgREST's ON CONFLICT cannot target partial unique indexes.
-- This migration adds a table-level UNIQUE constraint that works with PostgREST's
-- .upsert(..., { onConflict: 'org_id,provider_tx_id' }) syntax.
--
-- Performance: The new constraint includes NULL rows (treated as distinct), slightly
-- larger index than partial, but enables efficient batched upserts.

-- Step 1: Create unique index
-- Note: In Supabase SQL Editor, this must be run separately (cannot be in transaction)
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS transactions_org_provider_tx_unique
-- ON transactions(org_id, provider_tx_id);

-- Step 2: Attach as table constraint (run after Step 1 completes)
ALTER TABLE transactions
  ADD CONSTRAINT transactions_org_provider_tx_uniq
  UNIQUE USING INDEX transactions_org_provider_tx_unique;

-- The partial unique index (idx_transactions_org_provider_tx) will be dropped
-- after application code is deployed and verified to use the new constraint.
-- See migration 031 for cleanup.

COMMENT ON CONSTRAINT transactions_org_provider_tx_uniq ON transactions IS
'Ensures no duplicate transactions per org from same provider. Works with PostgREST ON CONFLICT for efficient upserts. Multiple NULL provider_tx_id values allowed (manual transactions).';

