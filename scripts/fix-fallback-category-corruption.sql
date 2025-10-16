-- Fix Historical Data Corruption from Manual Fallback Category Assignment
-- 
-- Issue: Previous manual fix used wrong category ID
-- - Used: 550e8400-e29b-41d4-a716-446655440304 (software_subscriptions)
-- - Should be: 550e8400-e29b-41d4-a716-446655440308 (miscellaneous)
--
-- This script corrects transactions that were marked as "Software & Technology"
-- but should have been "Miscellaneous" based on their decision rationale.
--
-- Date: October 14, 2025

BEGIN;

-- Step 1: Identify corrupted records for verification
SELECT 
  COUNT(*) as corrupted_count,
  'Transactions incorrectly marked as Software & Technology' as description
FROM transactions t
WHERE t.confidence = 0.3 
  AND t.category_id = '550e8400-e29b-41d4-a716-446655440304'  -- software_subscriptions
  AND EXISTS (
    SELECT 1 FROM decisions d 
    WHERE d.tx_id = t.id 
      AND d.rationale @> ARRAY['Manual fix: Silent categorization failure']
  );

-- Step 2: Fix transactions table
UPDATE transactions
SET 
  category_id = '550e8400-e29b-41d4-a716-446655440308',  -- Correct miscellaneous ID
  updated_at = NOW()
WHERE confidence = 0.3 
  AND category_id = '550e8400-e29b-41d4-a716-446655440304'  -- software_subscriptions (wrong)
  AND EXISTS (
    SELECT 1 FROM decisions d 
    WHERE d.tx_id = transactions.id 
      AND d.rationale @> ARRAY['Manual fix: Silent categorization failure']
  );

-- Step 3: Fix decision records
UPDATE decisions
SET 
  category_id = '550e8400-e29b-41d4-a716-446655440308'  -- Correct miscellaneous ID
WHERE rationale @> ARRAY['Manual fix: Silent categorization failure']
  AND category_id = '550e8400-e29b-41d4-a716-446655440304';  -- software_subscriptions (wrong)

-- Step 4: Verify the fix
SELECT 
  c.slug,
  c.name,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM transactions WHERE category_id IS NOT NULL), 2) as percentage
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE c.slug IN ('miscellaneous', 'software_subscriptions')
GROUP BY c.slug, c.name
ORDER BY c.slug;

-- Step 5: Check that no corrupted records remain
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All corrupted records fixed!'
    ELSE '⚠️  ' || COUNT(*) || ' corrupted records still remain'
  END as status
FROM transactions t
WHERE t.confidence = 0.3 
  AND t.category_id = '550e8400-e29b-41d4-a716-446655440304'
  AND EXISTS (
    SELECT 1 FROM decisions d 
    WHERE d.tx_id = t.id 
      AND d.rationale @> ARRAY['Manual fix: Silent categorization failure']
  );

COMMIT;

