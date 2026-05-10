/**
 * POST /api/admin/celebrations/[id]/approve
 *
 * Decision table (Req 28):
 *   - deleted / missing     → 404
 *   - already active        → 200 no-op (idempotent)
 *   - already inactive      → 409 CANNOT_APPROVE_INACTIVE
 *   - pending + expired     → 409 APPROVAL_WINDOW_ELAPSED
 *   - pending + fresh       → 200, sets status/approved_at/approved_by
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { approveIfPendingAndFresh } from '@/lib/db/celebrations';

export const POST = apiHandler<{ id: string }>(async (_req: NextRequest, { params }) => {
  const { updated, currentStatus, expires_at } = await approveIfPendingAndFresh(params.id);
  if (currentStatus === null) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  if (currentStatus === 'active') {
    return NextResponse.json({ ok: true, idempotent: true, row: updated });
  }
  if (currentStatus === 'inactive') {
    throw new HttpError(
      409,
      'CANNOT_APPROVE_INACTIVE',
      'Reactivate via Extend Expiry instead of Approve.',
    );
  }
  if (currentStatus === 'pending' && (!updated || (expires_at && new Date(expires_at).getTime() <= Date.now()))) {
    throw new HttpError(
      409,
      'APPROVAL_WINDOW_ELAPSED',
      "This celebration's window has already passed. Extend the expiry, then approve.",
    );
  }
  return NextResponse.json({ ok: true, row: updated });
});
