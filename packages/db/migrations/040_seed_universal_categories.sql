-- Migration 040: Seed Universal Categories (Clean Slate)
-- Deletes old vendor-specific categories and seeds new universal taxonomy
-- Safe to run since only test data exists

BEGIN;

-- ============================================================================
-- STEP 1: Clean Up Old Categories
-- ============================================================================

-- Delete old vendor-specific categories (test data only)
DELETE FROM categories 
WHERE org_id IS NULL  -- Only global categories
AND slug IN (
  -- Old payment processor categories
  'stripe_fees', 'paypal_fees', 'shop_pay_fees', 'bnpl_fees',
  'payment_processing_fees',  -- Old version if exists
  
  -- Old ad platform categories
  'ads_meta', 'ads_google', 'ads_tiktok', 'ads_other',
  'marketing',
  
  -- Old software categories
  'shopify_platform', 'app_subscriptions', 'email_sms_tools',
  'software_general',
  
  -- Old logistics categories  
  'fulfillment_3pl_fees', 'warehouse_storage', 'shipping_expense', 'returns_processing',
  
  -- Old e-commerce specific
  'dtc_sales', 'shipping_income', 'discounts_contra', 'refunds_allowances_contra',
  
  -- Old COGS
  'inventory_purchases', 'inbound_freight', 'packaging_supplies', 'manufacturing_costs',
  
  -- Old general
  'professional_services', 'rent_utilities', 'insurance', 'payroll_contractors',
  'office_supplies', 'travel', 'bank_fees', 'other_ops',
  
  -- Old non-P&L
  'sales_tax_payable', 'duties_import_taxes', 'shopify_payouts_clearing',
  'amazon_fees', 'amazon_payouts'
);

-- Note: This preserves org-specific categories (where org_id IS NOT NULL)
-- Only removes global test categories

-- ============================================================================
-- STEP 2: Seed Parent Categories (Tier 1)
-- ============================================================================

INSERT INTO categories (id, org_id, name, slug, parent_id, type, tier, is_pnl, industries, is_universal, attribute_schema, display_order, is_active)
VALUES
  -- Revenue Parent
  (
    '550e8400-e29b-41d4-a716-446655440100',
    NULL,
    'Revenue',
    'revenue',
    NULL,
    'revenue',
    1,
    true,
    '{"all"}',
    true,
    '{}',
    1,
    true
  ),
  -- COGS Parent
  (
    '550e8400-e29b-41d4-a716-446655440200',
    NULL,
    'Cost of Goods Sold',
    'cogs',
    NULL,
    'cogs',
    1,
    true,
    '{"all"}',
    true,
    '{}',
    2,
    true
  ),
  -- Operating Expenses Parent
  (
    '550e8400-e29b-41d4-a716-446655440300',
    NULL,
    'Operating Expenses',
    'operating_expenses',
    NULL,
    'opex',
    1,
    true,
    '{"all"}',
    true,
    '{}',
    3,
    true
  ),
  -- Taxes & Liabilities Parent
  (
    '550e8400-e29b-41d4-a716-446655440400',
    NULL,
    'Taxes & Liabilities',
    'taxes_liabilities',
    NULL,
    'liability',
    1,
    false,
    '{"all"}',
    true,
    '{}',
    4,
    true
  ),
  -- Clearing Parent
  (
    '550e8400-e29b-41d4-a716-446655440500',
    NULL,
    'Clearing',
    'clearing',
    NULL,
    'clearing',
    1,
    false,
    '{"all"}',
    true,
    '{}',
    5,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  type = EXCLUDED.type,
  tier = EXCLUDED.tier,
  is_pnl = EXCLUDED.is_pnl,
  industries = EXCLUDED.industries,
  is_universal = EXCLUDED.is_universal,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 3: Seed Revenue Categories
-- ============================================================================

INSERT INTO categories (id, org_id, name, slug, parent_id, type, tier, is_pnl, industries, is_universal, attribute_schema, display_order, is_active)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440101',
    NULL,
    'Product Sales',
    'product_sales',
    '550e8400-e29b-41d4-a716-446655440100',
    'revenue',
    2,
    true,
    '{"all"}',
    true,
    '{"channel": {"type": "enum", "values": ["online", "retail", "wholesale", "marketplace"], "required": false}, "product_line": {"type": "string", "required": false}}',
    1,
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440102',
    NULL,
    'Service Revenue',
    'service_revenue',
    '550e8400-e29b-41d4-a716-446655440100',
    'revenue',
    2,
    true,
    '{"all"}',
    true,
    '{"service_type": {"type": "string", "required": false}}',
    2,
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440103',
    NULL,
    'Shipping Income',
    'shipping_income',
    '550e8400-e29b-41d4-a716-446655440100',
    'revenue',
    2,
    true,
    '{"ecommerce"}',
    false,
    '{}',
    3,
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440105',
    NULL,
    'Refunds (Contra-Revenue)',
    'refunds_contra',
    '550e8400-e29b-41d4-a716-446655440100',
    'revenue',
    2,
    true,
    '{"all"}',
    true,
    '{"reason": {"type": "enum", "values": ["return", "cancellation", "chargeback", "error", "other"], "required": false}}',
    4,
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440106',
    NULL,
    'Discounts (Contra-Revenue)',
    'discounts_contra',
    '550e8400-e29b-41d4-a716-446655440100',
    'revenue',
    2,
    true,
    '{"all"}',
    true,
    '{}',
    5,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  tier = EXCLUDED.tier,
  is_pnl = EXCLUDED.is_pnl,
  industries = EXCLUDED.industries,
  is_universal = EXCLUDED.is_universal,
  attribute_schema = EXCLUDED.attribute_schema,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 4: Seed COGS Categories
-- ============================================================================

INSERT INTO categories (id, org_id, name, slug, parent_id, type, tier, is_pnl, industries, is_universal, attribute_schema, display_order, is_active)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440201',
    NULL,
    'Materials & Supplies',
    'materials_supplies',
    '550e8400-e29b-41d4-a716-446655440200',
    'cogs',
    2,
    true,
    '{"all"}',
    true,
    '{"supplier": {"type": "string", "required": false}, "material_type": {"type": "string", "required": false}}',
    1,
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440202',
    NULL,
    'Direct Labor',
    'direct_labor',
    '550e8400-e29b-41d4-a716-446655440200',
    'cogs',
    2,
    true,
    '{"all"}',
    true,
    '{}',
    2,
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440206',
    NULL,
    'Packaging',
    'packaging',
    '550e8400-e29b-41d4-a716-446655440200',
    'cogs',
    2,
    true,
    '{"ecommerce"}',
    false,
    '{}',
    3,
    true
  ),
  (
    '550e8400-e29b-41d4-a716-446655440207',
    NULL,
    'Freight & Shipping',
    'freight_shipping',
    '550e8400-e29b-41d4-a716-446655440200',
    'cogs',
    2,
    true,
    '{"all"}',
    true,
    '{"carrier": {"type": "enum", "values": ["USPS", "FedEx", "UPS", "DHL", "Other"], "required": false}, "direction": {"type": "enum", "values": ["inbound", "outbound"], "required": false}}',
    4,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  tier = EXCLUDED.tier,
  is_pnl = EXCLUDED.is_pnl,
  industries = EXCLUDED.industries,
  is_universal = EXCLUDED.is_universal,
  attribute_schema = EXCLUDED.attribute_schema,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 5: Seed Operating Expense Categories (Universal)
-- ============================================================================

INSERT INTO categories (id, org_id, name, slug, parent_id, type, tier, is_pnl, industries, is_universal, attribute_schema, display_order, is_active)
VALUES
  -- Marketing & Advertising
  (
    '550e8400-e29b-41d4-a716-446655440303',
    NULL,
    'Marketing & Advertising',
    'marketing_ads',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"platform": {"type": "enum", "values": ["Meta", "Google", "TikTok", "LinkedIn", "Pinterest", "Twitter", "Snapchat", "YouTube", "Other"], "required": false}, "campaign_type": {"type": "enum", "values": ["paid_social", "paid_search", "display", "video", "influencer", "affiliate", "email", "print", "other"], "required": false}, "campaign_name": {"type": "string", "required": false}}',
    1,
    true
  ),
  -- Software & Technology
  (
    '550e8400-e29b-41d4-a716-446655440304',
    NULL,
    'Software & Technology',
    'software_subscriptions',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"vendor": {"type": "string", "required": false}, "subscription_type": {"type": "enum", "values": ["monthly", "annual", "per_user", "usage_based", "one_time"], "required": false}, "category": {"type": "enum", "values": ["accounting", "crm", "productivity", "analytics", "communication", "design", "development", "marketing", "other"], "required": false}}',
    2,
    true
  ),
  -- Payment Processing Fees
  (
    '550e8400-e29b-41d4-a716-446655440301',
    NULL,
    'Payment Processing Fees',
    'payment_processing_fees',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"processor": {"type": "enum", "values": ["Stripe", "PayPal", "Square", "Shopify Payments", "Authorize.net", "Afterpay", "Affirm", "Klarna", "Apple Pay", "Other"], "required": false}, "fee_type": {"type": "enum", "values": ["transaction", "monthly", "chargeback", "setup", "other"], "required": false}}',
    3,
    true
  ),
  -- Payroll & Benefits
  (
    '550e8400-e29b-41d4-a716-446655440305',
    NULL,
    'Payroll & Benefits',
    'labor',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"role": {"type": "string", "required": false}, "department": {"type": "string", "required": false}, "employment_type": {"type": "enum", "values": ["full_time", "part_time", "contractor", "temp"], "required": false}}',
    4,
    true
  ),
  -- Professional Services
  (
    '550e8400-e29b-41d4-a716-446655440352',
    NULL,
    'Professional Services',
    'professional_services',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"service_type": {"type": "enum", "values": ["accounting", "legal", "consulting", "bookkeeping", "tax_prep", "other"], "required": false}, "provider": {"type": "string", "required": false}}',
    5,
    true
  ),
  -- Rent & Utilities
  (
    '550e8400-e29b-41d4-a716-446655440353',
    NULL,
    'Rent & Utilities',
    'rent_utilities',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"facility": {"type": "string", "required": false}, "utility_type": {"type": "enum", "values": ["electric", "gas", "water", "internet", "other"], "required": false}}',
    6,
    true
  ),
  -- Insurance
  (
    '550e8400-e29b-41d4-a716-446655440354',
    NULL,
    'Insurance',
    'insurance',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"policy_type": {"type": "enum", "values": ["general_liability", "property", "professional_liability", "workers_comp", "vehicle", "other"], "required": false}, "carrier": {"type": "string", "required": false}}',
    7,
    true
  ),
  -- Office Supplies
  (
    '550e8400-e29b-41d4-a716-446655440356',
    NULL,
    'Office Supplies',
    'office_supplies',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{}',
    8,
    true
  ),
  -- Travel & Meals
  (
    '550e8400-e29b-41d4-a716-446655440357',
    NULL,
    'Travel & Meals',
    'travel_meals',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"trip_purpose": {"type": "string", "required": false}, "location": {"type": "string", "required": false}}',
    9,
    true
  ),
  -- Bank & Merchant Fees
  (
    '550e8400-e29b-41d4-a716-446655440358',
    NULL,
    'Bank & Merchant Fees',
    'bank_fees',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"fee_type": {"type": "enum", "values": ["monthly", "overdraft", "wire_transfer", "atm", "other"], "required": false}, "institution": {"type": "string", "required": false}}',
    10,
    true
  ),
  -- Miscellaneous
  (
    '550e8400-e29b-41d4-a716-446655440308',
    NULL,
    'Miscellaneous',
    'miscellaneous',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"all"}',
    true,
    '{"note": {"type": "string", "required": false}}',
    99,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  tier = EXCLUDED.tier,
  is_pnl = EXCLUDED.is_pnl,
  industries = EXCLUDED.industries,
  is_universal = EXCLUDED.is_universal,
  attribute_schema = EXCLUDED.attribute_schema,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 6: Seed Industry-Specific Categories (E-commerce)
-- ============================================================================

INSERT INTO categories (id, org_id, name, slug, parent_id, type, tier, is_pnl, industries, is_universal, attribute_schema, display_order, is_active)
VALUES
  -- Fulfillment & Logistics
  (
    '550e8400-e29b-41d4-a716-446655440321',
    NULL,
    'Fulfillment & Logistics',
    'fulfillment_logistics',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"ecommerce"}',
    false,
    '{"provider": {"type": "enum", "values": ["ShipBob", "ShipMonk", "Deliverr", "Amazon FBA", "In-house", "Other"], "required": false}, "service_type": {"type": "enum", "values": ["pick_pack", "storage", "receiving", "returns", "other"], "required": false}}',
    20,
    true
  ),
  -- Platform Fees
  (
    '550e8400-e29b-41d4-a716-446655440322',
    NULL,
    'Platform Fees',
    'platform_fees',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"ecommerce"}',
    false,
    '{"platform": {"type": "enum", "values": ["Shopify", "Amazon", "Etsy", "eBay", "WooCommerce", "Other"], "required": false}, "fee_type": {"type": "enum", "values": ["monthly", "transaction", "listing", "referral", "other"], "required": false}}',
    21,
    true
  ),
  -- Hosting & Infrastructure (for SaaS - future)
  (
    '550e8400-e29b-41d4-a716-446655440323',
    NULL,
    'Hosting & Infrastructure',
    'hosting_infrastructure',
    '550e8400-e29b-41d4-a716-446655440300',
    'opex',
    2,
    true,
    '{"saas"}',
    false,
    '{"provider": {"type": "enum", "values": ["AWS", "Google Cloud", "Azure", "Heroku", "Vercel", "DigitalOcean", "Other"], "required": false}, "service_tier": {"type": "string", "required": false}}',
    22,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  tier = EXCLUDED.tier,
  is_pnl = EXCLUDED.is_pnl,
  industries = EXCLUDED.industries,
  is_universal = EXCLUDED.is_universal,
  attribute_schema = EXCLUDED.attribute_schema,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 7: Seed Non-P&L Categories
-- ============================================================================

INSERT INTO categories (id, org_id, name, slug, parent_id, type, tier, is_pnl, industries, is_universal, attribute_schema, display_order, is_active)
VALUES
  -- Sales Tax Payable
  (
    '550e8400-e29b-41d4-a716-446655440401',
    NULL,
    'Sales Tax Payable',
    'sales_tax_payable',
    '550e8400-e29b-41d4-a716-446655440400',
    'liability',
    2,
    false,
    '{"all"}',
    true,
    '{}',
    1,
    true
  ),
  -- Payouts Clearing
  (
    '550e8400-e29b-41d4-a716-446655440503',
    NULL,
    'Payouts Clearing',
    'payouts_clearing',
    '550e8400-e29b-41d4-a716-446655440500',
    'clearing',
    2,
    false,
    '{"all"}',
    true,
    '{"platform": {"type": "enum", "values": ["Shopify", "Square", "Stripe", "PayPal", "Other"], "required": false}}',
    1,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  tier = EXCLUDED.tier,
  is_pnl = EXCLUDED.is_pnl,
  industries = EXCLUDED.industries,
  is_universal = EXCLUDED.is_universal,
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
  -- Count seeded categories
  SELECT COUNT(*) INTO category_count
  FROM categories
  WHERE org_id IS NULL AND is_active = true;
  
  IF category_count < 20 THEN
    RAISE EXCEPTION 'Expected at least 20 categories, found only %', category_count;
  END IF;
  
  -- Verify all parent categories exist
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'revenue' AND is_active = true) THEN
    RAISE EXCEPTION 'Revenue parent category missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'cogs' AND is_active = true) THEN
    RAISE EXCEPTION 'COGS parent category missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'operating_expenses' AND is_active = true) THEN
    RAISE EXCEPTION 'Operating Expenses parent category missing';
  END IF;
  
  RAISE NOTICE 'Migration 040 verification passed ✓';
  RAISE NOTICE 'Seeded % universal categories', category_count;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION: Optional Cleanup for Test Data
-- ============================================================================
-- If you want to also clear test transactions, run separately:
-- DELETE FROM transactions WHERE org_id IN (SELECT id FROM orgs WHERE name LIKE '%Test%');
-- DELETE FROM decisions;
-- DELETE FROM corrections;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration:
-- 
-- BEGIN;
-- DELETE FROM categories WHERE org_id IS NULL;
-- -- Then re-seed your old categories if needed
-- COMMIT;

