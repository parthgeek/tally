-- Migration: Create waitlist_submissions table for landing page prelaunch
-- Created: 2025-10-06
-- Purpose: Store email signups from landing page waitlist during prelaunch phase

-- Create waitlist submissions table
CREATE TABLE IF NOT EXISTS public.waitlist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_submissions_email
  ON public.waitlist_submissions(email);

CREATE INDEX IF NOT EXISTS idx_waitlist_submissions_created_at
  ON public.waitlist_submissions(created_at DESC);

-- Enable RLS (service role key bypasses this anyway, but good practice)
ALTER TABLE public.waitlist_submissions ENABLE ROW LEVEL SECURITY;

-- No public policies needed - all access via service role key from API endpoint
-- This ensures waitlist submissions are only accessible server-side

-- Add comment for documentation
COMMENT ON TABLE public.waitlist_submissions IS
  'Stores email signups from landing page waitlist. Access via service role key only.';
COMMENT ON COLUMN public.waitlist_submissions.email IS
  'User email address (unique, lowercase, trimmed)';
COMMENT ON COLUMN public.waitlist_submissions.source IS
  'Referrer URL or source identifier';
COMMENT ON COLUMN public.waitlist_submissions.user_agent IS
  'User agent string for analytics';
