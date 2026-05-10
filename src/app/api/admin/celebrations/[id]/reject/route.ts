/**
 * POST /api/admin/celebrations/[id]/reject
 *
 * Decision table (Req 28.5/28.6/28.7):
 *   - deleted / missing → 404
 *   - active            → 409 CANNOT_REJECT_ACTIVE
 *   - pending           → 200, status='inactive', admin_notes optional
 *   - inactive          → 200 no-op; updates admin_notes only when provided
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { RejectSchema } from '@/lib/validation/admin';
import { rejectIfPendingOrInactive } from '@/lib/db/celebrations';

export const POST = apiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const body = await req.json().catch(() => ({}));
  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid reject request', parsed.error.issues);
  }
  const result = await rejectIfPendingOrInactive(params.id, parsed.data.admin_notes);
  if (!result.row && !result.conflict) {
    throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  }
  if (result.conflict === 'active') {
    throw new HttpError(409, 'CANNOT_REJECT_ACTIVE', 'Active celebrations must be toggled to inactive instead.');
  }
  if (result.conflict === 'deleted') {
    throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  }
  return NextResponse.json({ ok: true, row: result.row });
});
