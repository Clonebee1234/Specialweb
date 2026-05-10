/**
 * GET /api/admin/stats
 *
 * Dashboard counters. We issue a single SQL via the `rpc` path is overkill
 * for Supabase JS here — it's simpler to hit the REST endpoint a few times
 * in parallel. All counts are approximate-only (not transactional) which is
 * fine for a dashboard.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { getSupabaseServer } from '@/lib/supabase/server';

export const GET = apiHandler(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;

  const [active, pending, inactive, total, soon] = await Promise.all([
    db.from('celebrations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('celebrations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('celebrations').select('id', { count: 'exact', head: true }).eq('status', 'inactive'),
    db.from('celebrations').select('id', { count: 'exact', head: true }),
    db
      .from('celebrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .lt('expires_at', new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()),
  ]);

  return NextResponse.json({
    active: active.count ?? 0,
    pending: pending.count ?? 0,
    inactive: inactive.count ?? 0,
    totalEverCreated: total.count ?? 0,
    expiringNext2h: soon.count ?? 0,
  });
});
