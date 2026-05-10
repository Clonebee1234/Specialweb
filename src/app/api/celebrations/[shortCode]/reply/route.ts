/**
 * POST /api/celebrations/[shortCode]/reply
 *
 * Saves the recipient's optional reply. Requires a valid unlock cookie,
 * type='expression', and an active in-window celebration. Never logs text.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { findByShortCode, updateFields } from '@/lib/db/celebrations';
import { gate } from '@/lib/lifecycle';
import { isFresh, unlockCookieName, verifySignedPayload } from '@/lib/cookies';
import { ReplySchema } from '@/lib/validation/unlock';

export const POST = apiHandler<{ shortCode: string }>(async (req: NextRequest, { params }) => {
  const row = await findByShortCode(params.shortCode);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  if (row.type !== 'expression') {
    throw new HttpError(400, 'NOT_EXPRESSION', 'Replies are only supported on expression celebrations.');
  }
  const gateResult = gate({
    status: row.status,
    now: new Date(),
    activate_at: new Date(row.activate_at),
    expires_at: new Date(row.expires_at),
  });
  if (gateResult.state !== 'active') {
    throw new HttpError(410, 'CELEBRATION_ENDED', 'This celebration has ended.');
  }

  const cookie = req.cookies.get(unlockCookieName(row.short_code))?.value;
  const payload = cookie ? verifySignedPayload(cookie) : null;
  const valid =
    !!payload &&
    payload.kind === 'unlock' &&
    payload.shortCode === row.short_code &&
    payload.passcodeVersion === row.passcode_version &&
    isFresh(payload, Date.now());
  if (!valid) throw new HttpError(401, 'UNAUTHENTICATED', 'Unlock required.');

  const body = await req.json().catch(() => null);
  const parsed = ReplySchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Reply must be 1 to 200 characters.');
  }

  await updateFields(row.id, { expression_reply: parsed.data.replyText });
  return NextResponse.json({ ok: true });
});
