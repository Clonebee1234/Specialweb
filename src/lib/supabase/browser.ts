/**
 * Supabase browser client.
 *
 * Only uses the anon key (safe to embed in the client bundle). Intended for
 * direct reads of public Storage objects; no DB writes happen through this
 * client. All DB operations go through the server API routes.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseBrowser(): SupabaseClient<Database> {
  if (!cached) {
    cached = createClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return cached;
}
