-- Setup Categorization Worker Cron Job
-- This SQL script creates a scheduled job to run the categorization worker every 5 minutes
-- The worker acts as a safety net to ensure all transactions eventually get categorized

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing schedule if it exists (for idempotent setup)
SELECT cron.unschedule('categorization-worker') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'categorization-worker'
);

-- Schedule the worker to run every 5 minutes
-- The worker will:
-- 1. Find orgs with uncategorized transactions
-- 2. Call jobs-categorize-queue for each org
-- 3. Loop until all are categorized or hit batch limits
-- 4. Exit quickly if no work is found
SELECT cron.schedule(
  'categorization-worker',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url:='https://bbeqsixddvbzufvtifjt.supabase.co/functions/v1/jobs-categorize-worker',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the schedule was created successfully
SELECT 
  jobname,
  schedule,
  active,
  jobid
FROM cron.job 
WHERE jobname = 'categorization-worker';

-- To view cron job history (useful for debugging):
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'categorization-worker') ORDER BY start_time DESC LIMIT 10;

-- To disable the cron (if needed):
-- SELECT cron.unschedule('categorization-worker');

-- To manually trigger the worker (for testing):
-- SELECT net.http_post(
--   url:='https://bbeqsixddvbzufvtifjt.supabase.co/functions/v1/jobs-categorize-worker',
--   headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--   body:='{}'::jsonb
-- );

