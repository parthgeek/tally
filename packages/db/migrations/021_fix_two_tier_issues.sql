-- 021_fix_two_tier_issues.sql - Fix outstanding issues from two-tier taxonomy rollout
-- Addresses:
-- 1. Old category IDs (Banking & Fees, Software & Technology) still in use
-- 2. Payout misclassification (Stripe payouts going to payment_processing_fees)
-- 3. Sales tax handling (should go to taxes_liabilities instead of general_administrative)

-- ============================================================================
-- ISSUE 1: Remap old category IDs that weren't caught in migration 019
-- ============================================================================

-- Banking & Fees (550e8400-e29b-41d4-a716-446655440019) -> payment_processing_fees
-- This catches any transactions still using the old Banking & Fees category
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440301' -- Payment Processing Fees
WHERE category_id = '550e8400-e29b-41d4-a716-446655440019' -- Banking & Fees (old)
  OR category_id = '550e8400-e29b-41d4-a716-446655440021'; -- Bank Fees & Interest (old)

-- Software & Technology (550e8400-e29b-41d4-a716-446655440020) -> software_subscriptions
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440304' -- Software Subscriptions
WHERE category_id = '550e8400-e29b-41d4-a716-446655440020'; -- Software & Technology (old)

-- Update rules to map old categories
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440301' -- Payment Processing Fees
WHERE category_id = '550e8400-e29b-41d4-a716-446655440019' -- Banking & Fees (old)
  OR category_id = '550e8400-e29b-41d4-a716-446655440021'; -- Bank Fees & Interest (old)

UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440304' -- Software Subscriptions
WHERE category_id = '550e8400-e29b-41d4-a716-446655440020'; -- Software & Technology (old)

-- Update decisions
UPDATE decisions
SET category_id = '550e8400-e29b-41d4-a716-446655440301' -- Payment Processing Fees
WHERE category_id = '550e8400-e29b-41d4-a716-446655440019' -- Banking & Fees (old)
  OR category_id = '550e8400-e29b-41d4-a716-446655440021'; -- Bank Fees & Interest (old)

UPDATE decisions
SET category_id = '550e8400-e29b-41d4-a716-446655440304' -- Software Subscriptions
WHERE category_id = '550e8400-e29b-41d4-a716-446655440020'; -- Software & Technology (old)

-- Update corrections (old_category_id)
UPDATE corrections
SET old_category_id = '550e8400-e29b-41d4-a716-446655440301' -- Payment Processing Fees
WHERE old_category_id = '550e8400-e29b-41d4-a716-446655440019' -- Banking & Fees (old)
  OR old_category_id = '550e8400-e29b-41d4-a716-446655440021'; -- Bank Fees & Interest (old)

UPDATE corrections
SET old_category_id = '550e8400-e29b-41d4-a716-446655440304' -- Software Subscriptions
WHERE old_category_id = '550e8400-e29b-41d4-a716-446655440020'; -- Software & Technology (old)

-- Update corrections (new_category_id)
UPDATE corrections
SET new_category_id = '550e8400-e29b-41d4-a716-446655440301' -- Payment Processing Fees
WHERE new_category_id = '550e8400-e29b-41d4-a716-446655440019' -- Banking & Fees (old)
  OR new_category_id = '550e8400-e29b-41d4-a716-446655440021'; -- Bank Fees & Interest (old)

UPDATE corrections
SET new_category_id = '550e8400-e29b-41d4-a716-446655440304' -- Software Subscriptions
WHERE new_category_id = '550e8400-e29b-41d4-a716-446655440020'; -- Software & Technology (old)

-- ============================================================================
-- ISSUE 2: Enhanced payout detection to prevent fees misclassification
-- ============================================================================

-- Delete less specific payout rules to avoid conflicts (we'll add better ones below)
DELETE FROM rules 
WHERE pattern->>'type' = 'vendor' 
  AND (
    pattern->'vendor_keywords' @> '["stripe"]'::jsonb 
    OR pattern->'vendor_keywords' @> '["paypal"]'::jsonb
    OR pattern->'vendor_keywords' @> '["shopify"]'::jsonb
  )
  AND category_id IN (
    '550e8400-e29b-41d4-a716-446655440301', -- Payment Processing Fees
    '550e8400-e29b-41d4-a716-446655440304'  -- Software Subscriptions
  );

-- Add new high-priority payout detection rules (highest weight = 1.0)
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  -- Shopify payouts (highest priority)
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["shopify"], "description_keywords": ["payout", "transfer", "deposit", "settlement", "disbursement"], "type": "payout_detection"}', '550e8400-e29b-41d4-a716-446655440503', 1.0, now()),
  
  -- Stripe payouts (highest priority)
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["stripe"], "description_keywords": ["payout", "transfer", "deposit", "settlement", "disbursement"], "type": "payout_detection"}', '550e8400-e29b-41d4-a716-446655440503', 1.0, now()),
  
  -- PayPal payouts (highest priority)
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["paypal"], "description_keywords": ["payout", "transfer", "deposit", "settlement", "disbursement"], "type": "payout_detection"}', '550e8400-e29b-41d4-a716-446655440503', 1.0, now()),
  
  -- Square payouts
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["square"], "description_keywords": ["payout", "transfer", "deposit", "settlement"], "type": "payout_detection"}', '550e8400-e29b-41d4-a716-446655440503', 1.0, now())
ON CONFLICT (id) DO NOTHING;

-- Add fee-specific rules (lower weight = 0.92, only triggers on explicit fee keywords)
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  -- Stripe fees (requires explicit "fee" keyword)
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["stripe"], "description_keywords": ["fee", "charge", "processing"], "type": "vendor_and_description"}', '550e8400-e29b-41d4-a716-446655440301', 0.92, now()),
  
  -- PayPal fees (requires explicit "fee" keyword)
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["paypal"], "description_keywords": ["fee", "charge", "processing"], "type": "vendor_and_description"}', '550e8400-e29b-41d4-a716-446655440301', 0.92, now()),
  
  -- Shop Pay fees
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["shop pay", "shop-pay"], "description_keywords": ["fee", "processing"], "type": "vendor_and_description"}', '550e8400-e29b-41d4-a716-446655440301', 0.92, now()),
  
  -- BNPL fees
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["afterpay", "affirm", "klarna", "sezzle"], "description_keywords": ["fee"], "type": "vendor_and_description"}', '550e8400-e29b-41d4-a716-446655440301', 0.90, now())
ON CONFLICT (id) DO NOTHING;

-- Add Shopify platform subscription rule (no fee keywords, just "subscription" or "plan")
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["shopify"], "description_keywords": ["subscription", "plan", "monthly", "app"], "type": "vendor_and_description"}', '550e8400-e29b-41d4-a716-446655440304', 0.93, now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ISSUE 3: Sales tax handling - add taxes_liabilities category if not exists
-- ============================================================================

-- Insert taxes_liabilities category under clearing (hidden from P&L)
-- Note: Categories table doesn't have a slug column - slug is maintained in application code only
INSERT INTO categories (id, org_id, name, parent_id) VALUES
  ('550e8400-e29b-41d4-a716-446655440601', NULL, 'Taxes & Liabilities', '550e8400-e29b-41d4-a716-446655440500')
ON CONFLICT (id) DO NOTHING;

-- Add sales tax detection rules
INSERT INTO rules (id, org_id, pattern, category_id, weight, created_at) VALUES
  -- State/federal tax payments
  (gen_random_uuid(), NULL, '{"description_keywords": ["sales tax", "state tax", "tax payment", "irs"], "type": "description"}', '550e8400-e29b-41d4-a716-446655440601', 0.95, now()),
  
  -- Merchant names for tax authorities
  (gen_random_uuid(), NULL, '{"vendor_keywords": ["state of", "department of revenue", "irs", "franchise tax"], "type": "vendor"}', '550e8400-e29b-41d4-a716-446655440601', 0.95, now())
ON CONFLICT (id) DO NOTHING;

-- Optionally remap existing sales tax transactions (currently in general_administrative)
-- Commented out by default - uncomment if you want to retroactively remap
-- UPDATE transactions
-- SET category_id = '550e8400-e29b-41d4-a716-446655440601' -- Taxes & Liabilities
-- WHERE category_id = '550e8400-e29b-41d4-a716-446655440307' -- General & Administrative
--   AND (
--     description ILIKE '%sales tax%'
--     OR description ILIKE '%state tax%'
--     OR description ILIKE '%tax payment%'
--     OR merchant_name ILIKE '%state of%'
--     OR merchant_name ILIKE '%department of revenue%'
--   );

-- ============================================================================
-- VERIFICATION QUERIES (for manual checks after migration)
-- ============================================================================

-- Check for any remaining old category IDs in transactions
-- SELECT category_id, COUNT(*) 
-- FROM transactions 
-- WHERE category_id IN (
--   '550e8400-e29b-41d4-a716-446655440019', -- Banking & Fees
--   '550e8400-e29b-41d4-a716-446655440020', -- Software & Technology
--   '550e8400-e29b-41d4-a716-446655440021'  -- Bank Fees & Interest
-- )
-- GROUP BY category_id;

-- Check payout vs fee rules priority
-- SELECT 
--   pattern->>'type' as rule_type,
--   pattern->'vendor_keywords' as vendors,
--   pattern->'description_keywords' as keywords,
--   category_id,
--   weight
-- FROM rules
-- WHERE pattern->'vendor_keywords' @> '["stripe"]'::jsonb
--    OR pattern->'vendor_keywords' @> '["paypal"]'::jsonb
--    OR pattern->'vendor_keywords' @> '["shopify"]'::jsonb
-- ORDER BY weight DESC;

-- Add comment to track this migration
COMMENT ON TABLE rules IS 'Updated in migration 021: Fixed old category mappings, enhanced payout detection, added sales tax handling';
