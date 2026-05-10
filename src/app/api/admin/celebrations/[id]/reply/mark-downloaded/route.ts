/** POST /api/admin/celebrations/[id]/reply/mark-downloaded — flip the flag. */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { findById, updateFields } from '@/lib/db/celebrations';

export const POST = apiHandler<{ id: string }>(async (_req: NextRequest, { params }) => {
  const row = await findById(params.id);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  await updateFields(params.id, { expression_reply_downloaded: true });
  return NextResponse.json({ ok: true });
});
