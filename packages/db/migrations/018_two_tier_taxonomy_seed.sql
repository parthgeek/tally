-- 018_two_tier_taxonomy_seed.sql - Two-tier taxonomy umbrella buckets
-- Seeds new Tier 2 umbrella bucket categories with deterministic UUIDs
-- Preserves existing UUIDs where slugs are retained, mints new UUIDs for new/renamed slugs

-- Revenue: add missing buckets (shipping_income and refunds_contra already exist)
-- Update refunds_allowances_contra to refunds_contra
INSERT INTO categories (id, org_id, name, parent_id, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440105', NULL, 'Refunds (Contra-Revenue)', '550e8400-e29b-41d4-a716-446655440100', now())
ON CONFLICT (id) DO NOTHING;

-- COGS: add new buckets and preserve existing ones
INSERT INTO categories (id, org_id, name, parent_id, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440205', NULL, 'Supplier Purchases', '550e8400-e29b-41d4-a716-446655440200', now()),
  ('550e8400-e29b-41d4-a716-446655440206', NULL, 'Packaging', '550e8400-e29b-41d4-a716-446655440200', now()),
  ('550e8400-e29b-41d4-a716-446655440207', NULL, 'Shipping & Postage', '550e8400-e29b-41d4-a716-446655440200', now()),
  ('550e8400-e29b-41d4-a716-446655440208', NULL, 'Returns Processing', '550e8400-e29b-41d4-a716-446655440200', now())
ON CONFLICT (id) DO NOTHING;

-- OpEx: add new umbrella buckets
INSERT INTO categories (id, org_id, name, parent_id, created_at) VALUES
  -- Reuse existing payment_processing_fees ID
  -- ('550e8400-e29b-41d4-a716-446655440301' already exists as 'Payment Processing Fees')

  -- Marketing umbrella bucket (rename existing marketing from '550e8400-e29b-41d4-a716-446655440302')
  ('550e8400-e29b-41d4-a716-446655440303', NULL, 'Marketing & Ads', '550e8400-e29b-41d4-a716-446655440300', now()),

  -- Software subscriptions umbrella bucket
  ('550e8400-e29b-41d4-a716-446655440304', NULL, 'Software Subscriptions', '550e8400-e29b-41d4-a716-446655440300', now()),

  -- Labor
  ('550e8400-e29b-41d4-a716-446655440305', NULL, 'Labor', '550e8400-e29b-41d4-a716-446655440300', now()),

  -- Operations & Logistics umbrella bucket
  ('550e8400-e29b-41d4-a716-446655440306', NULL, 'Operations & Logistics', '550e8400-e29b-41d4-a716-446655440300', now()),

  -- General & Administrative umbrella bucket
  ('550e8400-e29b-41d4-a716-446655440307', NULL, 'General & Administrative', '550e8400-e29b-41d4-a716-446655440300', now()),

  -- Miscellaneous umbrella bucket
  ('550e8400-e29b-41d4-a716-446655440308', NULL, 'Miscellaneous', '550e8400-e29b-41d4-a716-446655440300', now())
ON CONFLICT (id) DO NOTHING;

-- Hidden non-P&L: add payouts_clearing
INSERT INTO categories (id, org_id, name, parent_id, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440503', NULL, 'Payouts Clearing', '550e8400-e29b-41d4-a716-446655440500', now())
ON CONFLICT (id) DO NOTHING;

-- Update the refunds category name to match new taxonomy
UPDATE categories
SET name = 'Refunds (Contra-Revenue)'
WHERE id = '550e8400-e29b-41d4-a716-446655440104';

-- Move returns_processing from OpEx to COGS (it should be under COGS per the plan)
-- First check if it exists as OpEx and update to COGS
UPDATE categories
SET parent_id = '550e8400-e29b-41d4-a716-446655440200', -- COGS parent
    name = 'Returns Processing'
WHERE id = '550e8400-e29b-41d4-a716-446655440344'
  AND parent_id = '550e8400-e29b-41d4-a716-446655440300'; -- Currently under OpEx

-- Ensure index exists for faster lookups
CREATE INDEX IF NOT EXISTS idx_categories_global_name ON categories(name) WHERE org_id IS NULL;