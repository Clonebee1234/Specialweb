/**
 * POST /api/cron/expire
 *
 * Invoked hourly by Vercel Cron. Transitions active celebrations whose
 * `expires_at` is in the past to `inactive`. Idempotent by construction
 * (Req 27.7): a second invocation matches zero rows.
 *
 * Auth: the caller must present `x-cron-secret: <CRON_SECRET>`. Wrong or
 * missing → 401 with no DB writes.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { env } from '@/lib/env';
import { getSupabaseServer } from '@/lib/supabase/server';

export const POST = apiHandler(async (req: NextRequest) => {
  const presented = req.headers.get('x-cron-secret') ?? '';
  const a = Buffer.from(presented);
  const b = Buffer.from(env.CRON_SECRET);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid cron secret.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  const { data, error } = await db
    .from('celebrations')
    .update({ status: 'inactive' })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id');
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  const updated = Array.isArray(data) ? data.length : 0;
  return NextResponse.json({ updated });
});
