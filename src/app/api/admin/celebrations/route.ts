/**
 * GET /api/admin/celebrations
 *
 * Admin list with filters, search, sort, pagination. The query string is
 * validated via `AdminListQuerySchema` to avoid stitching user input into
 * SQL column names.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { AdminListQuerySchema } from '@/lib/validation/adminQuery';
import { getSupabaseServer } from '@/lib/supabase/server';

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams);
  const parsed = AdminListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid query', parsed.error.issues);
  }
  const q = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  let query = db
    .from('celebrations')
    .select(
      'id,short_code,type,status,theme,recipient_name,creator_name,relationship,activate_at,expires_at,created_at,approved_at,view_count,times_reactivated,expression_reply,expression_reply_downloaded',
      { count: 'exact' },
    )
    .neq('status', 'deleted');

  if (q.status.length > 0) query = query.in('status', q.status);
  if (q.type.length > 0) query = query.in('type', q.type);
  if (q.activateFrom) query = query.gte('activate_at', q.activateFrom);
  if (q.activateTo) query = query.lte('activate_at', q.activateTo);
  if (q.q) {
    const term = q.q.toLowerCase().replace(/[%_,]/g, '');
    query = query.or(
      `recipient_name.ilike.%${term}%,creator_name.ilike.%${term}%,short_code.ilike.%${term}%`,
    );
  }

  query = query.order(q.sort, { ascending: q.order === 'asc' });

  const from = (q.page - 1) * q.pageSize;
  const to = from + q.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);

  return NextResponse.json({
    rows: data ?? [],
    page: q.page,
    pageSize: q.pageSize,
    total: count ?? 0,
  });
});
