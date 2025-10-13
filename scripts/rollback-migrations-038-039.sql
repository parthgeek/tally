-- Rollback Script for Migrations 038-039
-- WARNING: This will remove all attribute data from transactions
-- Make sure you have a backup before running this!

BEGIN;

-- ============================================================================
-- Remove Migration 039 (Validation Functions)
-- ============================================================================

DROP TRIGGER IF EXISTS validate_attributes_trigger ON transactions;
DROP FUNCTION IF EXISTS validate_transaction_attributes();
DROP FUNCTION IF EXISTS get_attribute(jsonb, text, text);
DROP FUNCTION IF EXISTS has_attribute(jsonb, text);
DROP FUNCTION IF EXISTS get_attribute_keys(jsonb);
DROP FUNCTION IF EXISTS get_attribute_distribution(uuid, text, date, date);
DROP FUNCTION IF EXISTS get_attribute_coverage(uuid, date, date);
DROP VIEW IF EXISTS transactions_with_attributes;

-- ============================================================================
-- Remove Migration 038 (Schema Changes)
-- ============================================================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_transactions_attributes;
DROP INDEX IF EXISTS idx_transactions_attributes_jsonb_path_ops;
DROP INDEX IF EXISTS idx_categories_industries;
DROP INDEX IF EXISTS idx_categories_universal_active;
DROP INDEX IF EXISTS idx_categories_slug_global;

-- Drop columns from transactions table
ALTER TABLE transactions DROP COLUMN IF EXISTS attributes;

-- Drop constraint first
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;

-- Drop columns from categories table
ALTER TABLE categories 
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS industries,
  DROP COLUMN IF EXISTS is_universal,
  DROP COLUMN IF EXISTS tier,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS attribute_schema,
  DROP COLUMN IF EXISTS display_order,
  DROP COLUMN IF EXISTS is_pnl;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
    -- Verify columns removed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'attributes'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: transactions.attributes still exists';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'slug'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: categories.slug still exists';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'industries'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: categories.industries still exists';
    END IF;

    RAISE NOTICE 'Rollback completed successfully ✓';
END $$;

COMMIT;

