/**
 * GET /api/admin/celebrations/[id]  — fetch one row (including deleted).
 * PATCH /api/admin/celebrations/[id] — edit fields + status toggle + extend.
 * DELETE /api/admin/celebrations/[id] — permanent delete with short_code echo.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { findById, updateFields, extendExpiry, hardDeleteRow } from '@/lib/db/celebrations';
import { PatchCelebrationSchema, PermanentDeleteSchema } from '@/lib/validation/admin';
import { deletePrefix } from '@/lib/db/storage';

export const GET = apiHandler<{ id: string }>(async (_req: NextRequest, { params }) => {
  const row = await findById(params.id);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  return NextResponse.json({ row });
});

export const PATCH = apiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const body = await req.json().catch(() => null);
  const parsed = PatchCelebrationSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid patch', parsed.error.issues);
  }
  const input = parsed.data;

  const existing = await findById(params.id);
  if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  if (existing.status === 'pending' && input.status) {
    throw new HttpError(
      409,
      'CANNOT_TOGGLE_PENDING',
      'Pending celebrations must be approved or rejected via the dedicated endpoints.',
    );
  }

  // Extend is handled separately because it needs special semantics
  // (times_reactivated bump, potential inactive→active flip).
  if (input.extend_hours !== undefined) {
    const row = await extendExpiry(params.id, input.extend_hours);
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
    // If the request combined extend with other edits, apply them on top.
    const { extend_hours: _skip, ...rest } = input;
    if (Object.keys(rest).length > 0) {
      const patched = await updateFields(params.id, stripUndefined(rest) as Partial<typeof row>);
      return NextResponse.json({ row: patched ?? row });
    }
    return NextResponse.json({ row });
  }

  const patched = await updateFields(params.id, stripUndefined(input) as Partial<typeof existing>);
  if (!patched) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  return NextResponse.json({ row: patched });
});

/** Removes keys whose value is undefined so Partial<> satisfies exactOptionalPropertyTypes. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export const DELETE = apiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const body = await req.json().catch(() => null);
  const parsed = PermanentDeleteSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Confirmation required', parsed.error.issues);
  }
  const existing = await findById(params.id);
  if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  if (existing.short_code !== parsed.data.confirmShortCode) {
    throw new HttpError(400, 'CONFIRMATION_MISMATCH', 'Short code confirmation does not match.');
  }

  // Purge storage first; if that fails we don't want to orphan DB rows
  // and vice versa (Req 17.7).
  await deletePrefix(existing.short_code);
  await hardDeleteRow(params.id);
  return NextResponse.json({ ok: true });
});
