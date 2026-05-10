/**
 * GET /api/celebrations/[shortCode]/status
 *
 * Public lifecycle gate. Returns only a coarse state string and — only when
 * relevant — the `activate_at` for a pre-activation celebration. Never leaks
 * theme, content, or timing for pending/ended/deleted rows.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { findByShortCode } from '@/lib/db/celebrations';
import { gate } from '@/lib/lifecycle';

export const GET = apiHandler<{ shortCode: string }>(async (_req: NextRequest, { params }) => {
  const row = await findByShortCode(params.shortCode);
  if (!row) return NextResponse.json({ status: 'not_found' }, { status: 404 });

  const result = gate({
    status: row.status,
    now: new Date(),
    activate_at: new Date(row.activate_at),
    expires_at: new Date(row.expires_at),
  });

  if (result.state === 'pre_activation' && result.activate_at) {
    return NextResponse.json({ status: 'pre_activation', activate_at: result.activate_at.toISOString() });
  }
  return NextResponse.json({ status: result.state });
});
