-- Migration 039: Attribute Validation Functions
-- Helper functions for validating and querying transaction attributes
-- Part of universal taxonomy redesign

BEGIN;

-- ============================================================================
-- VALIDATION FUNCTION: Validate Transaction Attributes Against Schema
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_transaction_attributes()
RETURNS trigger AS $$
DECLARE
  category_schema jsonb;
  attr_key text;
  attr_value jsonb;
  schema_def jsonb;
  valid_values text[];
  attr_type text;
  is_required boolean;
BEGIN
  -- Skip if no attributes or category
  IF NEW.attributes IS NULL OR NEW.attributes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get category schema
  SELECT attribute_schema INTO category_schema
  FROM categories
  WHERE id = NEW.category_id;

  -- Skip validation if no schema defined (allows flexible usage)
  IF category_schema IS NULL OR category_schema = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- Validate each attribute
  FOR attr_key, attr_value IN SELECT * FROM jsonb_each(NEW.attributes)
  LOOP
    schema_def := category_schema->attr_key;
    
    -- Check if attribute is defined in schema
    IF schema_def IS NULL THEN
      -- Just log warning, don't block (allows custom attributes)
      RAISE WARNING '[Attribute Validation] Attribute "%" not defined in schema for category %. This may be intentional.', 
        attr_key, NEW.category_id;
      CONTINUE;
    END IF;

    -- Extract schema properties
    attr_type := schema_def->>'type';
    is_required := COALESCE((schema_def->>'required')::boolean, false);

    -- Check required constraint
    IF is_required AND (attr_value IS NULL OR attr_value::text = 'null') THEN
      RAISE WARNING '[Attribute Validation] Required attribute "%" is missing or null for category %', 
        attr_key, NEW.category_id;
    END IF;

    -- Validate enum types
    IF attr_type = 'enum' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(schema_def->'values')) INTO valid_values;
      
      IF attr_value #>> '{}' != ALL(valid_values) THEN
        RAISE WARNING '[Attribute Validation] Invalid value "%" for attribute "%". Expected one of: %', 
          attr_value #>> '{}', attr_key, array_to_string(valid_values, ', ');
      END IF;
    END IF;

    -- Validate number type
    IF attr_type = 'number' THEN
      BEGIN
        -- Try to cast to numeric
        PERFORM (attr_value #>> '{}')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[Attribute Validation] Attribute "%" must be a number, got: %', 
          attr_key, attr_value #>> '{}';
      END;
    END IF;

    -- Validate boolean type
    IF attr_type = 'boolean' THEN
      IF attr_value::text NOT IN ('true', 'false') THEN
        RAISE WARNING '[Attribute Validation] Attribute "%" must be a boolean, got: %', 
          attr_key, attr_value #>> '{}';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_transaction_attributes() IS 
'Validates transaction attributes against the category attribute schema.
Issues warnings for invalid attributes but does not block transactions.
This allows flexibility while providing validation feedback.';

-- ============================================================================
-- TRIGGER: Validate Attributes (OPTIONAL - Disabled by Default)
-- ============================================================================

-- Create trigger but keep it DISABLED by default for performance
-- Enable later if strict validation is needed
-- To enable: ALTER TABLE transactions ENABLE TRIGGER validate_attributes_trigger;

CREATE TRIGGER validate_attributes_trigger
  BEFORE INSERT OR UPDATE OF attributes, category_id ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_attributes();

-- Disable by default to avoid performance impact
ALTER TABLE transactions DISABLE TRIGGER validate_attributes_trigger;

COMMENT ON TRIGGER validate_attributes_trigger ON transactions IS 
'Validates attributes against category schema. 
DISABLED by default for performance.
Enable with: ALTER TABLE transactions ENABLE TRIGGER validate_attributes_trigger;';

-- ============================================================================
-- HELPER FUNCTION: Get Attribute Value with Default
-- ============================================================================

CREATE OR REPLACE FUNCTION get_attribute(
  tx_attributes jsonb,
  attr_key text,
  default_value text DEFAULT NULL
) RETURNS text AS $$
BEGIN
  RETURN COALESCE(tx_attributes->>attr_key, default_value);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_attribute(jsonb, text, text) IS 
'Safely extract an attribute value from transaction attributes JSONB.
Usage: SELECT get_attribute(attributes, ''processor'', ''Unknown'') FROM transactions;';

-- ============================================================================
-- HELPER FUNCTION: Check if Attribute Exists
-- ============================================================================

CREATE OR REPLACE FUNCTION has_attribute(
  tx_attributes jsonb,
  attr_key text
) RETURNS boolean AS $$
BEGIN
  RETURN tx_attributes ? attr_key;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION has_attribute(jsonb, text) IS 
'Check if a transaction has a specific attribute defined.
Usage: SELECT * FROM transactions WHERE has_attribute(attributes, ''platform'');';

-- ============================================================================
-- HELPER FUNCTION: Get Attribute Keys
-- ============================================================================

CREATE OR REPLACE FUNCTION get_attribute_keys(
  tx_attributes jsonb
) RETURNS text[] AS $$
BEGIN
  RETURN ARRAY(SELECT jsonb_object_keys(tx_attributes));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_attribute_keys(jsonb) IS 
'Get all attribute keys from a transaction.
Usage: SELECT id, get_attribute_keys(attributes) FROM transactions;';

-- ============================================================================
-- VIEW: Transactions with Expanded Attributes
-- ============================================================================

CREATE OR REPLACE VIEW transactions_with_attributes AS
SELECT 
  t.id,
  t.org_id,
  t.date,
  t.amount_cents,
  t.description,
  t.merchant_name,
  t.category_id,
  c.name as category_name,
  c.slug as category_slug,
  t.attributes,
  t.confidence,
  t.reviewed,
  -- Common attribute extractions
  get_attribute(t.attributes, 'platform') as attr_platform,
  get_attribute(t.attributes, 'processor') as attr_processor,
  get_attribute(t.attributes, 'vendor') as attr_vendor,
  get_attribute(t.attributes, 'campaign_type') as attr_campaign_type,
  get_attribute(t.attributes, 'provider') as attr_provider,
  -- Count of attributes (using jsonb_object_keys which returns SETOF text)
  (SELECT COUNT(*) FROM jsonb_object_keys(t.attributes)) as attribute_count
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id;

COMMENT ON VIEW transactions_with_attributes IS 
'Convenience view that expands common transaction attributes into columns.
Makes it easier to query and analyze transactions by attributes without JSONB syntax.';

-- ============================================================================
-- ANALYTICS FUNCTION: Attribute Distribution Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_attribute_distribution(
  p_org_id uuid,
  p_category_slug text DEFAULT NULL,
  p_date_from date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  attribute_key text,
  attribute_value text,
  transaction_count bigint,
  percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH attribute_pairs AS (
    SELECT 
      t.id,
      key as attr_key,
      value #>> '{}' as attr_value
    FROM transactions t
    CROSS JOIN LATERAL jsonb_each(t.attributes)
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.org_id = p_org_id
      AND t.date BETWEEN p_date_from AND p_date_to
      AND t.attributes != '{}'::jsonb
      AND (p_category_slug IS NULL OR c.slug = p_category_slug)
  ),
  total_with_attrs AS (
    SELECT COUNT(DISTINCT id) as total
    FROM attribute_pairs
  )
  SELECT 
    ap.attr_key as attribute_key,
    ap.attr_value as attribute_value,
    COUNT(*)::bigint as transaction_count,
    ROUND((COUNT(*)::numeric / NULLIF(t.total, 0) * 100), 2) as percentage
  FROM attribute_pairs ap
  CROSS JOIN total_with_attrs t
  GROUP BY ap.attr_key, ap.attr_value, t.total
  ORDER BY ap.attr_key, transaction_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_attribute_distribution(uuid, text, date, date) IS 
'Generate a distribution report of attribute usage for an organization.
Shows which attributes are most common and their values.
Useful for understanding categorization patterns and data quality.';

-- ============================================================================
-- ANALYTICS FUNCTION: Attribute Coverage Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_attribute_coverage(
  p_org_id uuid,
  p_date_from date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category_name text,
  category_slug text,
  total_transactions bigint,
  transactions_with_attributes bigint,
  coverage_percentage numeric,
  avg_attributes_per_transaction numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as category_name,
    c.slug as category_slug,
    COUNT(*)::bigint as total_transactions,
    COUNT(*) FILTER (WHERE t.attributes != '{}'::jsonb)::bigint as transactions_with_attributes,
    ROUND(
      (COUNT(*) FILTER (WHERE t.attributes != '{}'::jsonb)::numeric / NULLIF(COUNT(*), 0) * 100),
      2
    ) as coverage_percentage,
    ROUND(
      AVG((SELECT COUNT(*) FROM jsonb_object_keys(t.attributes)))::numeric,
      2
    ) as avg_attributes_per_transaction
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
  WHERE t.org_id = p_org_id
    AND t.date BETWEEN p_date_from AND p_date_to
    AND t.category_id IS NOT NULL
  GROUP BY c.id, c.name, c.slug
  ORDER BY total_transactions DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_attribute_coverage(uuid, date, date) IS 
'Analyze attribute coverage by category.
Shows what percentage of transactions in each category have attributes extracted.
Helps identify categories that need better attribute extraction.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    -- Verify functions were created
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'validate_transaction_attributes'
    ) THEN
        RAISE EXCEPTION 'Function validate_transaction_attributes was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_attribute'
    ) THEN
        RAISE EXCEPTION 'Function get_attribute was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_attribute_distribution'
    ) THEN
        RAISE EXCEPTION 'Function get_attribute_distribution was not created';
    END IF;

    -- Verify trigger exists (even if disabled)
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'validate_attributes_trigger'
    ) THEN
        RAISE EXCEPTION 'Trigger validate_attributes_trigger was not created';
    END IF;

    -- Verify view exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE viewname = 'transactions_with_attributes'
    ) THEN
        RAISE EXCEPTION 'View transactions_with_attributes was not created';
    END IF;

    RAISE NOTICE 'Migration 039 verification passed ✓';
END $$;

COMMIT;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Query transactions by specific attribute
-- SELECT * FROM transactions 
-- WHERE attributes->>'platform' = 'Meta';

-- Example 2: Get attribute distribution for marketing category
-- SELECT * FROM get_attribute_distribution(
--   'org-uuid-here'::uuid, 
--   'marketing_ads', 
--   CURRENT_DATE - INTERVAL '30 days',
--   CURRENT_DATE
-- );

-- Example 3: Check attribute coverage
-- SELECT * FROM get_attribute_coverage('org-uuid-here'::uuid);

-- Example 4: Find transactions missing expected attributes
-- SELECT t.id, t.description, c.slug, t.attributes
-- FROM transactions t
-- JOIN categories c ON t.category_id = c.id
-- WHERE c.slug = 'payment_processing_fees'
--   AND NOT has_attribute(t.attributes, 'processor');

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, run:
-- 
-- BEGIN;
-- DROP TRIGGER IF EXISTS validate_attributes_trigger ON transactions;
-- DROP FUNCTION IF EXISTS validate_transaction_attributes();
-- DROP FUNCTION IF EXISTS get_attribute(jsonb, text, text);
-- DROP FUNCTION IF EXISTS has_attribute(jsonb, text);
-- DROP FUNCTION IF EXISTS get_attribute_keys(jsonb);
-- DROP FUNCTION IF EXISTS get_attribute_distribution(uuid, text, date, date);
-- DROP FUNCTION IF EXISTS get_attribute_coverage(uuid, date, date);
-- DROP VIEW IF EXISTS transactions_with_attributes;
-- COMMIT;

