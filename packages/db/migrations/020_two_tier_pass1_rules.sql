-- 020_two_tier_pass1_rules.sql - Update Pass-1 rules to target umbrella buckets
-- Updates existing rules to point to two-tier taxonomy umbrella buckets

-- Payment Processing: Consolidate all payment processor rules to payment_processing_fees umbrella
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440301' -- Payment Processing Fees umbrella
WHERE category_id IN (
    '550e8400-e29b-41d4-a716-446655440311', -- Stripe Fees
    '550e8400-e29b-41d4-a716-446655440312', -- PayPal Fees
    '550e8400-e29b-41d4-a716-446655440313', -- Shop Pay Fees
    '550e8400-e29b-41d4-a716-446655440314'  -- BNPL Fees
);

-- Marketing: Consolidate all ad platform rules to marketing_ads umbrella
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440303' -- Marketing & Ads umbrella
WHERE category_id IN (
    '550e8400-e29b-41d4-a716-446655440302', -- Marketing & Advertising (old parent)
    '550e8400-e29b-41d4-a716-446655440321', -- Meta Ads
    '550e8400-e29b-41d4-a716-446655440322', -- Google Ads
    '550e8400-e29b-41d4-a716-446655440323', -- TikTok Ads
    '550e8400-e29b-41d4-a716-446655440324'  -- Other Ads
);

-- Software: Consolidate platform and software rules to software_subscriptions umbrella
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440304' -- Software Subscriptions umbrella
WHERE category_id IN (
    '550e8400-e29b-41d4-a716-446655440331', -- Shopify Platform
    '550e8400-e29b-41d4-a716-446655440332', -- App Subscriptions
    '550e8400-e29b-41d4-a716-446655440333'  -- Email/SMS Tools
);

-- Operations & Logistics: Consolidate shipping and 3PL rules
-- Note: We need to distinguish between outbound shipping (COGS) and operational logistics (OpEx)
-- For now, shipping carriers go to shipping_postage (COGS), fulfillment/3PL goes to operations_logistics (OpEx)

-- Shipping carriers and postage -> shipping_postage (COGS)
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440207' -- Shipping & Postage (COGS)
WHERE category_id = '550e8400-e29b-41d4-a716-446655440343' -- Shipping Expense (old)
  AND (
    pattern->'vendor_keywords' @> '["usps"]'::jsonb OR
    pattern->'vendor_keywords' @> '["ups"]'::jsonb OR
    pattern->'vendor_keywords' @> '["fedex"]'::jsonb OR
    pattern->'vendor_keywords' @> '["dhl"]'::jsonb OR
    pattern->'description_keywords' @> '["shipping"]'::jsonb OR
    pattern->'description_keywords' @> '["postage"]'::jsonb
  );

-- 3PL and fulfillment services -> operations_logistics (OpEx)
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440306' -- Operations & Logistics umbrella
WHERE category_id IN (
    '550e8400-e29b-41d4-a716-446655440341', -- Fulfillment & 3PL Fees
    '550e8400-e29b-41d4-a716-446655440342'  -- Warehouse Storage
);

-- Shipping platforms and software -> operations_logistics (OpEx)
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440306' -- Operations & Logistics umbrella
WHERE category_id = '550e8400-e29b-41d4-a716-446655440343' -- Shipping Expense (old)
  AND (
    pattern->'vendor_keywords' @> '["shipstation"]'::jsonb OR
    pattern->'vendor_keywords' @> '["shippo"]'::jsonb OR
    pattern->'vendor_keywords' @> '["easypost"]'::jsonb
  );

-- General & Administrative: Consolidate business expenses
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440307' -- General & Administrative umbrella
WHERE category_id IN (
    '550e8400-e29b-41d4-a716-446655440352', -- Professional Services
    '550e8400-e29b-41d4-a716-446655440353', -- Rent & Utilities
    '550e8400-e29b-41d4-a716-446655440354', -- Insurance
    '550e8400-e29b-41d4-a716-446655440356', -- Office Supplies
    '550e8400-e29b-41d4-a716-446655440358'  -- Bank Fees
);

-- Miscellaneous: Travel and other misc expenses
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440308' -- Miscellaneous umbrella
WHERE category_id = '550e8400-e29b-41d4-a716-446655440357'; -- Travel & Transportation

-- COGS: Update inventory and manufacturing rules to new umbrella buckets
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440205' -- Supplier Purchases umbrella
WHERE category_id = '550e8400-e29b-41d4-a716-446655440201'; -- Inventory Purchases

UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440206' -- Packaging umbrella
WHERE category_id = '550e8400-e29b-41d4-a716-446655440203'; -- Packaging Supplies

-- Manufacturing costs can stay under supplier_purchases for simplicity
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440205' -- Supplier Purchases umbrella
WHERE category_id = '550e8400-e29b-41d4-a716-446655440204'; -- Manufacturing Costs

-- Payouts: Update clearing rules to use payouts_clearing umbrella
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440503' -- Payouts Clearing umbrella
WHERE category_id = '550e8400-e29b-41d4-a716-446655440501'; -- Shopify Payouts Clearing

-- Add new rules for common two-tier taxonomy patterns
-- Refund detection rules
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  (gen_random_uuid(), NULL, '{"description_keywords": ["refund", "return", "chargeback"], "type": "refund_detection"}', '550e8400-e29b-41d4-a716-446655440105', 0.95, now()),
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["stripe"], "description_keywords": ["chb"], "type": "vendor_and_description"}', '550e8400-e29b-41d4-a716-446655440105', 0.9, now())
ON CONFLICT (id) DO NOTHING;

-- Labor/payroll rules
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  (gen_random_uuid(), NULL, '{"description_keywords": ["payroll", "salary", "wages", "contractor"], "type": "description"}', '550e8400-e29b-41d4-a716-446655440305', 0.9, now()),
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["gusto", "adp", "quickbooks payroll"], "type": "vendor"}', '550e8400-e29b-41d4-a716-446655440305', 0.9, now())
ON CONFLICT (id) DO NOTHING;

-- Returns processing rules (COGS)
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  (gen_random_uuid(), NULL, '{"description_keywords": ["return processing", "rma", "restocking"], "type": "description"}', '550e8400-e29b-41d4-a716-446655440208', 0.85, now())
ON CONFLICT (id) DO NOTHING;

-- Enhanced payout detection for multiple processors
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["paypal"], "description_keywords": ["transfer", "payout"], "type": "payout_detection"}', '550e8400-e29b-41d4-a716-446655440503', 0.95, now()),
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["stripe"], "description_keywords": ["transfer", "payout"], "type": "payout_detection"}', '550e8400-e29b-41d4-a716-446655440503', 0.95, now()),
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["square"], "description_keywords": ["transfer", "payout"], "type": "payout_detection"}', '550e8400-e29b-41d4-a716-446655440503', 0.95, now())
ON CONFLICT (id) DO NOTHING;

-- Add comment to track this migration
COMMENT ON TABLE rules IS 'Updated in migration 020: Retargeted Pass-1 rules to two-tier umbrella buckets';