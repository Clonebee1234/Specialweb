/**
 * Supabase server client.
 *
 * Imports `env.SUPABASE_SERVICE_ROLE_KEY` which is server-only. Never import
 * this file from a Client Component — Next.js will fail the build to protect
 * the secret, but the responsibility to keep it server-side is ours.
 *
 * The service role key bypasses RLS, so EVERY query in this app must live in
 * a route handler that first authenticates the caller (admin cookie, unlock
 * cookie, cron header, or nothing for purely public reads).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseServer(): SupabaseClient<Database> {
  if (!cached) {
    cached = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-client-info': 'celebrate-them-server' } },
    });
  }
  return cached;
}
