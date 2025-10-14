-- Migration 042: Clean up redundant unique indexes on transactions table
-- Removes duplicate unique indexes/constraints for (org_id, provider_tx_id)
-- Keeps only the primary unique constraint: transactions_org_provider_tx_uniq

-- Drop redundant unique indexes (keeping the main constraint)
DROP INDEX IF EXISTS idx_transactions_org_provider_tx;
DROP INDEX IF EXISTS idx_transactions_provider_tx_unique;

-- Verify we still have the main constraint
-- transactions_org_provider_tx_uniq should remain as the single source of truth

COMMENT ON CONSTRAINT transactions_org_provider_tx_uniq ON transactions IS 
'Primary unique constraint ensuring no duplicate transactions per org from same provider. '
'Used with PostgREST upsert ON CONFLICT for efficient idempotent inserts. '
'Multiple NULL provider_tx_id values allowed (manual transactions).';

