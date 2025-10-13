-- Migration 038: Universal Taxonomy Schema
-- Add support for multi-vertical attributes and industry flags
-- Part of taxonomy redesign to support multiple industries with universal categories

-- This migration adds:
-- 1. attributes column to transactions (for industry-specific metadata)
-- 2. industry metadata columns to categories
-- 3. Indexes for efficient querying
-- 4. Comments for documentation

BEGIN;

-- ============================================================================
-- TRANSACTIONS TABLE: Add Attributes Column
-- ============================================================================

-- Add attributes column for storing industry-specific transaction metadata
-- Examples: {platform: "Meta", processor: "Stripe", campaign: "Q4-2025"}
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}';

-- Create GIN index for efficient attribute queries
-- Allows fast lookups like: WHERE attributes->>'platform' = 'Meta'
CREATE INDEX IF NOT EXISTS idx_transactions_attributes 
ON transactions USING gin(attributes);

-- Add index for common attribute queries
CREATE INDEX IF NOT EXISTS idx_transactions_attributes_jsonb_path_ops
ON transactions USING gin(attributes jsonb_path_ops);

COMMENT ON COLUMN transactions.attributes IS 
'Industry-specific attributes stored as JSONB. Examples: 
 - E-commerce: {platform: "Shopify", processor: "Stripe", campaign: "Q4-2025"}
 - SaaS: {subscription_tier: "Pro", billing_cycle: "annual"}
 - Restaurant: {location: "Downtown", meal_period: "dinner"}
Used for detailed categorization without creating vendor-specific categories.';

-- ============================================================================
-- CATEGORIES TABLE: Add Industry Support
-- ============================================================================

-- Add slug column for category identification (used by categorizer)
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS slug text;

-- Add unique constraint on slug for global categories (where org_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_global 
ON categories (slug) WHERE org_id IS NULL;

-- Add industries array - which industries this category applies to
-- ["all"] = universal category (works for all industries)
-- ["ecommerce", "saas"] = industry-specific category
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS industries text[] DEFAULT '{"all"}';

-- Add flag indicating if this is a universal vs industry-specific category
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS is_universal boolean DEFAULT true;

-- Add tier level (1 = parent like "Revenue", 2 = operational like "Marketing")
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS tier integer DEFAULT 2;

-- Add type field for category classification
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS type text;

-- Add constraint for type values (drop first if exists)
DO $$ 
BEGIN
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
    ALTER TABLE categories ADD CONSTRAINT categories_type_check 
    CHECK (type IN ('revenue', 'cogs', 'opex', 'liability', 'clearing', 'asset', 'equity'));
END $$;

-- Add attribute schema - defines what attributes this category accepts
-- Used for validation and UI generation
-- Example: {"processor": {"type": "enum", "values": ["Stripe", "PayPal"], "required": false}}
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS attribute_schema jsonb DEFAULT '{}';

-- Add display order for consistent UI sorting
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Add isPnL flag (is this a P&L category?)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS is_pnl boolean DEFAULT true;

-- Create GIN index for efficient industry filtering
-- Allows queries like: WHERE 'ecommerce' = ANY(industries)
CREATE INDEX IF NOT EXISTS idx_categories_industries 
ON categories USING gin(industries);

-- Create index for active universal categories (most common query)
CREATE INDEX IF NOT EXISTS idx_categories_universal_active
ON categories (is_universal, is_active)
WHERE is_universal = true AND is_active = true;

-- Add helpful comments
COMMENT ON COLUMN categories.slug IS 
'URL-friendly identifier for the category. Used by categorizer code.
Examples: "payment_processing_fees", "marketing_ads", "software_subscriptions"
Should be unique for global categories (where org_id IS NULL).';

COMMENT ON COLUMN categories.type IS
'Category type for financial statement classification:
 - revenue: Revenue/income
 - cogs: Cost of goods sold
 - opex: Operating expenses
 - liability: Liabilities
 - clearing: Clearing/suspense accounts
 - asset: Assets
 - equity: Equity accounts';

COMMENT ON COLUMN categories.industries IS 
'Array of industry codes this category applies to. 
 - ["all"] means universal category (works for all industries)
 - ["ecommerce"] means e-commerce specific
 - ["ecommerce", "saas"] means applies to multiple specific industries';

COMMENT ON COLUMN categories.is_universal IS 
'True if category applies to all industries (e.g., "Marketing", "Software").
 False if category is industry-specific (e.g., "Fulfillment & Logistics" for e-commerce only).';

COMMENT ON COLUMN categories.tier IS 
'Category hierarchy tier:
 - 1 = Top-level parent (Revenue, COGS, Operating Expenses)
 - 2 = Operational category (Marketing, Software, Payment Processing)
 - 3 = Sub-category (rarely used, prefer attributes instead)';

COMMENT ON COLUMN categories.is_pnl IS
'True if this category appears on P&L statement (income statement).
False for balance sheet categories (assets, liabilities) and clearing accounts.';

COMMENT ON COLUMN categories.attribute_schema IS 
'JSON schema defining what attributes this category accepts.
Used for validation and UI generation.
Example: {
  "processor": {
    "type": "enum",
    "values": ["Stripe", "PayPal", "Square"],
    "required": false,
    "description": "Payment processor name"
  },
  "fee_type": {
    "type": "enum", 
    "values": ["transaction", "monthly", "setup"],
    "required": false
  }
}';

COMMENT ON COLUMN categories.display_order IS 
'Sort order for displaying categories in UI.
Lower numbers appear first. 
Universal categories typically 1-20, industry-specific 21+.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
DO $$
BEGIN
    -- Check transactions.attributes exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'attributes'
    ) THEN
        RAISE EXCEPTION 'Column transactions.attributes was not created';
    END IF;

    -- Check categories.slug exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'categories' 
        AND column_name = 'slug'
    ) THEN
        RAISE EXCEPTION 'Column categories.slug was not created';
    END IF;

    -- Check categories.industries exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'categories' 
        AND column_name = 'industries'
    ) THEN
        RAISE EXCEPTION 'Column categories.industries was not created';
    END IF;
    
    -- Check categories.type exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'categories' 
        AND column_name = 'type'
    ) THEN
        RAISE EXCEPTION 'Column categories.type was not created';
    END IF;

    -- Check indexes exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'transactions' 
        AND indexname = 'idx_transactions_attributes'
    ) THEN
        RAISE EXCEPTION 'Index idx_transactions_attributes was not created';
    END IF;

    RAISE NOTICE 'Migration 038 verification passed ✓';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, run:
-- 
-- BEGIN;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS attributes;
-- ALTER TABLE categories 
--   DROP COLUMN IF EXISTS slug,
--   DROP COLUMN IF EXISTS industries,
--   DROP COLUMN IF EXISTS is_universal,
--   DROP COLUMN IF EXISTS tier,
--   DROP COLUMN IF EXISTS type,
--   DROP COLUMN IF EXISTS attribute_schema,
--   DROP COLUMN IF EXISTS display_order,
--   DROP COLUMN IF EXISTS is_pnl;
-- DROP INDEX IF EXISTS idx_transactions_attributes;
-- DROP INDEX IF EXISTS idx_transactions_attributes_jsonb_path_ops;
-- DROP INDEX IF EXISTS idx_categories_industries;
-- DROP INDEX IF EXISTS idx_categories_universal_active;
-- DROP INDEX IF EXISTS idx_categories_slug_global;
-- ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
-- COMMIT;

