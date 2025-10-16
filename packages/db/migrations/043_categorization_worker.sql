-- Migration 043: Categorization Background Worker Support
-- Adds database functions to support the continuous categorization worker

-- Drop function if it exists (for idempotent migrations)
DROP FUNCTION IF EXISTS get_orgs_with_uncategorized_transactions();

-- Create function to find orgs with uncategorized transactions
-- This is called by the background worker to determine which orgs need processing
CREATE OR REPLACE FUNCTION get_orgs_with_uncategorized_transactions()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  uncategorized_count bigint,
  oldest_uncategorized timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    o.id as org_id,
    o.name as org_name,
    COUNT(t.id) as uncategorized_count,
    MIN(t.created_at) as oldest_uncategorized
  FROM orgs o
  INNER JOIN transactions t ON o.id = t.org_id
  WHERE t.category_id IS NULL
  GROUP BY o.id, o.name
  HAVING COUNT(t.id) > 0
  ORDER BY MIN(t.created_at) ASC  -- Process oldest uncategorized first (FIFO)
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_orgs_with_uncategorized_transactions() IS 
'Returns organizations that have uncategorized transactions, ordered by oldest uncategorized transaction. Used by the categorization background worker to find work.';

-- Grant execute permission to authenticated users (edge functions use service role, but good practice)
GRANT EXECUTE ON FUNCTION get_orgs_with_uncategorized_transactions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_orgs_with_uncategorized_transactions() TO service_role;

