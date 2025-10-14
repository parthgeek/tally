-- Migration 041: Add four essential operating expense categories
-- Adds telecommunications, vehicle_transportation, repairs_maintenance, legal_compliance
-- These categories provide clear boundaries to avoid LLM confusion

BEGIN;

INSERT INTO categories (id, org_id, name, slug, parent_id, type, tier, is_pnl, industries, is_universal, attribute_schema, display_order, is_active)
VALUES
  -- Telecommunications
  (
    '550e8400-e29b-41d4-a716-446655440361',
    NULL,
    'Telecommunications',
    'telecommunications',
    '550e8400-e29b-41d4-a716-446655440300', -- operating_expenses parent
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"service_type": {"type": "enum", "values": ["mobile", "landline", "voip", "conferencing", "other"], "required": false, "description": "Type of telecom service"}, "provider": {"type": "string", "required": false, "description": "Telecom provider name"}}',
    11,
    true
  ),
  -- Vehicle & Transportation
  (
    '550e8400-e29b-41d4-a716-446655440363',
    NULL,
    'Vehicle & Transportation',
    'vehicle_transportation',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"expense_type": {"type": "enum", "values": ["fuel", "maintenance", "payment", "insurance", "rideshare", "parking", "tolls", "other"], "required": false, "description": "Type of vehicle expense"}, "vehicle": {"type": "string", "required": false, "description": "Vehicle identifier"}}',
    12,
    true
  ),
  -- Repairs & Maintenance
  (
    '550e8400-e29b-41d4-a716-446655440362',
    NULL,
    'Repairs & Maintenance',
    'repairs_maintenance',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"asset_type": {"type": "enum", "values": ["building", "equipment", "machinery", "hvac", "plumbing", "electrical", "other"], "required": false, "description": "Type of asset being repaired"}, "vendor": {"type": "string", "required": false, "description": "Repair service provider"}}',
    13,
    true
  ),
  -- Legal & Compliance
  (
    '550e8400-e29b-41d4-a716-446655440366',
    NULL,
    'Legal & Compliance',
    'legal_compliance',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"service_type": {"type": "enum", "values": ["legal_fees", "trademark", "patents", "regulatory", "compliance", "litigation", "contracts", "other"], "required": false, "description": "Type of legal service"}, "firm": {"type": "string", "required": false, "description": "Law firm or legal provider name"}}',
    14,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  parent_id = EXCLUDED.parent_id,
  attribute_schema = EXCLUDED.attribute_schema,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  category_count integer;
BEGIN
  -- Count categories (should be 34 now: 30 + 4 new ones)
  SELECT COUNT(*) INTO category_count
  FROM categories
  WHERE org_id IS NULL AND is_active = true;
  
  IF category_count < 34 THEN
    RAISE EXCEPTION 'Expected at least 34 categories, found only %', category_count;
  END IF;
  
  -- Verify all new categories exist
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'telecommunications' AND is_active = true) THEN
    RAISE EXCEPTION 'Telecommunications category missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'vehicle_transportation' AND is_active = true) THEN
    RAISE EXCEPTION 'Vehicle & Transportation category missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'repairs_maintenance' AND is_active = true) THEN
    RAISE EXCEPTION 'Repairs & Maintenance category missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'legal_compliance' AND is_active = true) THEN
    RAISE EXCEPTION 'Legal & Compliance category missing';
  END IF;
  
  RAISE NOTICE 'Migration 041 verification passed ✓';
  RAISE NOTICE 'Total categories: %', category_count;
END $$;

COMMIT;

-- ============================================================================
-- CATEGORY DISAMBIGUATION GUIDE
-- ============================================================================
-- 
-- Key distinctions to avoid LLM confusion:
--
-- Mobile phone bill          → telecommunications (NOT rent_utilities)
-- Internet service           → rent_utilities (NOT telecommunications)
-- Uber to airport for trip   → travel_meals (NOT vehicle_transportation)
-- Uber to local client       → vehicle_transportation (NOT travel_meals)
-- Gas for company car        → vehicle_transportation (NOT travel_meals)
-- Attorney fees              → legal_compliance (NOT professional_services)
-- CPA tax preparation        → professional_services (NOT legal_compliance)
-- HVAC repair                → repairs_maintenance (NOT rent_utilities)
-- Vehicle oil change         → vehicle_transportation (NOT repairs_maintenance)
--
-- ============================================================================

