-- 017_remove_salon_categories.sql - Remove legacy salon-specific categories
-- This migration removes salon-specific categories that conflict with the e-commerce taxonomy

-- First, update any transactions that are currently assigned to salon-specific categories
-- Map them to appropriate e-commerce categories

-- Hair Services → DTC Sales (revenue category)
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id = '550e8400-e29b-41d4-a716-446655440002'; -- Hair Services

-- Nail Services → DTC Sales (revenue category)
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id = '550e8400-e29b-41d4-a716-446655440003'; -- Nail Services

-- Skin Care Services → DTC Sales (revenue category)
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id = '550e8400-e29b-41d4-a716-446655440004'; -- Skin Care Services

-- Massage Services → DTC Sales (revenue category)
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id = '550e8400-e29b-41d4-a716-446655440005'; -- Massage Services

-- Product Sales → DTC Sales (already appropriate)
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id = '550e8400-e29b-41d4-a716-446655440006'; -- Product Sales

-- Gift Cards → DTC Sales (gift cards are still sales)
UPDATE transactions
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id = '550e8400-e29b-41d4-a716-446655440007'; -- Gift Cards

-- Update any rules that reference salon-specific categories
UPDATE rules
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id IN (
    '550e8400-e29b-41d4-a716-446655440002', -- Hair Services
    '550e8400-e29b-41d4-a716-446655440003', -- Nail Services
    '550e8400-e29b-41d4-a716-446655440004', -- Skin Care Services
    '550e8400-e29b-41d4-a716-446655440005', -- Massage Services
    '550e8400-e29b-41d4-a716-446655440006', -- Product Sales
    '550e8400-e29b-41d4-a716-446655440007'  -- Gift Cards
);

-- Update any decisions that reference salon-specific categories
UPDATE decisions
SET category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE category_id IN (
    '550e8400-e29b-41d4-a716-446655440002', -- Hair Services
    '550e8400-e29b-41d4-a716-446655440003', -- Nail Services
    '550e8400-e29b-41d4-a716-446655440004', -- Skin Care Services
    '550e8400-e29b-41d4-a716-446655440005', -- Massage Services
    '550e8400-e29b-41d4-a716-446655440006', -- Product Sales
    '550e8400-e29b-41d4-a716-446655440007'  -- Gift Cards
);

-- Update any corrections that reference salon-specific categories in old_category_id
UPDATE corrections
SET old_category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE old_category_id IN (
    '550e8400-e29b-41d4-a716-446655440002', -- Hair Services
    '550e8400-e29b-41d4-a716-446655440003', -- Nail Services
    '550e8400-e29b-41d4-a716-446655440004', -- Skin Care Services
    '550e8400-e29b-41d4-a716-446655440005', -- Massage Services
    '550e8400-e29b-41d4-a716-446655440006', -- Product Sales
    '550e8400-e29b-41d4-a716-446655440007'  -- Gift Cards
);

-- Update any corrections that reference salon-specific categories in new_category_id
UPDATE corrections
SET new_category_id = '550e8400-e29b-41d4-a716-446655440101' -- DTC Sales
WHERE new_category_id IN (
    '550e8400-e29b-41d4-a716-446655440002', -- Hair Services
    '550e8400-e29b-41d4-a716-446655440003', -- Nail Services
    '550e8400-e29b-41d4-a716-446655440004', -- Skin Care Services
    '550e8400-e29b-41d4-a716-446655440005', -- Massage Services
    '550e8400-e29b-41d4-a716-446655440006', -- Product Sales
    '550e8400-e29b-41d4-a716-446655440007'  -- Gift Cards
);

-- Now remove the salon-specific categories
-- Remove child categories first to avoid foreign key constraint issues
DELETE FROM categories WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440002', -- Hair Services
    '550e8400-e29b-41d4-a716-446655440003', -- Nail Services
    '550e8400-e29b-41d4-a716-446655440004', -- Skin Care Services
    '550e8400-e29b-41d4-a716-446655440005', -- Massage Services
    '550e8400-e29b-41d4-a716-446655440006', -- Product Sales
    '550e8400-e29b-41d4-a716-446655440007'  -- Gift Cards
);

-- Update the old Revenue parent category to point to the new e-commerce Revenue parent
-- This ensures any remaining references use the correct parent
UPDATE categories
SET parent_id = NULL
WHERE id = '550e8400-e29b-41d4-a716-446655440001'; -- Old Revenue parent

-- Remove the old Revenue parent category if it's no longer needed
-- (Keep it as it might be referenced elsewhere, just ensure it doesn't conflict)

-- Add a comment to track this migration
COMMENT ON TABLE categories IS 'Updated in migration 017: Removed salon-specific categories and migrated to e-commerce taxonomy';