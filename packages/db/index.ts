import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!anonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

/**
 * Get Supabase client with service role key (bypasses RLS)
 * Use for admin operations, migrations, and background jobs
 */
export function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Get Supabase client with anonymous key (respects RLS)
 * Use for normal application operations
 */
export function getClient() {
  return createClient(supabaseUrl, anonKey);
}