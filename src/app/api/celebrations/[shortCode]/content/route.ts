/**
 * GET /api/celebrations/[shortCode]/content
 *
 * Returns the public payload to a recipient whose unlock cookie is valid.
 * Requires:
 *   - Signed cookie that matches the short_code and current passcode_version.
 *   - Status=active AND current time in [activate_at, expires_at).
 *
 * NEVER returns: passcode, admin_notes, approved_*, expression_reply,
 * expression_reply_downloaded, view_count, last_viewed_at.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { findByShortCode } from '@/lib/db/celebrations';
import { isFresh, unlockCookieName, verifySignedPayload } from '@/lib/cookies';
import { gate } from '@/lib/lifecycle';
import type { CelebrationRow } from '@/lib/supabase/types';

export const GET = apiHandler<{ shortCode: string }>(async (req: NextRequest, { params }) => {
  const row = await findByShortCode(params.shortCode);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');

  const gateResult = gate({
    status: row.status,
    now: new Date(),
    activate_at: new Date(row.activate_at),
    expires_at: new Date(row.expires_at),
  });
  if (gateResult.state !== 'active') {
    throw new HttpError(
      gateResult.state === 'ended' ? 410 : gateResult.state === 'pre_activation' ? 403 : 404,
      gateResult.state === 'ended'
        ? 'CELEBRATION_ENDED'
        : gateResult.state === 'pre_activation'
          ? 'NOT_YET_ACTIVE'
          : 'NOT_FOUND',
      'Celebration not available.',
    );
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

  return NextResponse.json(toPublicPayload(row));
});

function toPublicPayload(row: CelebrationRow) {
  const base = {
    type: row.type,
    theme: row.theme,
    recipient_name: row.recipient_name,
    creator_name: row.creator_name,
    relationship: row.relationship,
    song_url: row.song_url,
    photos: row.photos,
  };
  if (row.type === 'birthday') {
    return {
      ...base,
      hero_text: row.hero_text,
      reasons: row.reasons ?? [],
      quiz_questions: row.quiz_questions ?? [],
      final_message: row.final_message,
    };
  }
  return {
    ...base,
    confession_message: row.confession_message,
    things_i_notice: row.things_i_notice ?? [],
    closing_line: row.closing_line,
  };
}
