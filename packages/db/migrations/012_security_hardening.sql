-- 012_security_hardening.sql - Security hardening for database functions and views
-- Addresses Supabase security linter warnings by fixing search_path and view security properties

-- Fix mutable search_path issues for database functions
-- This prevents function hijacking by setting explicit search paths

-- 1. Fix bulk_correct_transactions function search_path
ALTER FUNCTION public.bulk_correct_transactions(uuid[], uuid, uuid, uuid, boolean) 
SET search_path = public, pg_temp;

-- 2. Fix update_normalized_vendors function search_path
ALTER FUNCTION public.update_normalized_vendors(integer) 
SET search_path = public, pg_temp;

-- 3. Fix normalize_vendor function search_path (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'normalize_vendor'
  ) THEN
    -- Function exists, fix its search_path
    EXECUTE 'ALTER FUNCTION public.normalize_vendor SET search_path = public, pg_temp';
  END IF;
END $$;

-- 4. Fix user_in_org function search_path (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'user_in_org'
  ) THEN
    -- Function exists, fix its search_path
    EXECUTE 'ALTER FUNCTION public.user_in_org SET search_path = public, pg_temp';
  END IF;
END $$;

-- 5. Fix review_queue view SECURITY DEFINER property
-- First check if the view exists, then recreate it without SECURITY DEFINER
DO $$
DECLARE
  view_definition text;
BEGIN
  -- Get the current view definition
  SELECT pg_get_viewdef('public.review_queue', true) 
  INTO view_definition 
  WHERE EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'review_queue'
  );
  
  IF view_definition IS NOT NULL THEN
    -- Drop and recreate the view as a regular view (not SECURITY DEFINER)
    DROP VIEW IF EXISTS public.review_queue;
    
    -- Recreate as a standard view with security_barrier = true for RLS
    EXECUTE 'CREATE VIEW public.review_queue WITH (security_barrier = true) AS ' || view_definition;
    
    -- Add comment explaining the security change
    COMMENT ON VIEW public.review_queue IS 
    'Review queue view recreated without SECURITY DEFINER for improved security. Uses security_barrier for RLS enforcement.';
  END IF;
END $$;

-- Add comments explaining the security improvements
COMMENT ON FUNCTION public.bulk_correct_transactions(uuid[], uuid, uuid, uuid, boolean) IS 
'Atomically corrects multiple transactions and optionally creates/updates vendor rules. Returns correction count, rule signature, and any errors encountered. search_path fixed for security.';

COMMENT ON FUNCTION public.update_normalized_vendors(integer) IS 
'Background job function to populate normalized_vendor column for improved rule matching performance. Processes transactions in batches to avoid long-running transactions. search_path fixed for security.';

-- Log the security hardening completion
DO $$
BEGIN
  RAISE NOTICE 'Security hardening migration 012 completed: Fixed search_path for functions and SECURITY DEFINER for views';
END $$;