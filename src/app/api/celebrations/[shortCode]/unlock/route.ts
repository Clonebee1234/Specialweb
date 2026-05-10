/**
 * POST /api/celebrations/[shortCode]/unlock
 *
 * Recipient passcode submission:
 *   - Rate limit 10/15m per (shortCode, IP) via Upstash/in-memory bucket.
 *   - Reject immediately if the celebration isn't currently active/in-window.
 *   - Verify with constant-time scrypt compare.
 *   - On success, set `ct_unlock_{shortCode}` signed cookie embedding
 *     `passcodeVersion`, then atomically bump view_count (30-min dedupe).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { UnlockSchema } from '@/lib/validation/unlock';
import { findByShortCode, tryBumpViewCount } from '@/lib/db/celebrations';
import { verifyPasscode } from '@/lib/passcode';
import { gate } from '@/lib/lifecycle';
import { RateLimitBuckets, getRateLimiter } from '@/lib/rate-limit';
import {
  signPayload,
  unlockCookieName,
  UNLOCK_TTL_SEC,
} from '@/lib/cookies';

export const POST = apiHandler<{ shortCode: string }>(async (req: NextRequest, { params }) => {
  const body = await req.json().catch(() => null);
  const parsed = UnlockSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Passcode must be 4 digits.');
  }

  const row = await findByShortCode(params.shortCode);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');

  const gateResult = gate({
    status: row.status,
    now: new Date(),
    activate_at: new Date(row.activate_at),
    expires_at: new Date(row.expires_at),
  });
  if (gateResult.state === 'pending' || gateResult.state === 'not_found') {
    throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  }
  if (gateResult.state === 'ended') {
    throw new HttpError(410, 'CELEBRATION_ENDED', 'This celebration has ended.');
  }
  if (gateResult.state === 'pre_activation') {
    throw new HttpError(403, 'NOT_YET_ACTIVE', 'This celebration has not started yet.');
  }

  // Rate limit only after we know the row exists/is in a valid state so we
  // don't punish polls against missing codes.
  const ip = getClientIp(req);
  const bucket = RateLimitBuckets.unlock(params.shortCode, ip);
  const rl = await getRateLimiter().consume(bucket.key, bucket.limit, bucket.windowMs);
  if (!rl.ok) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.');
  }

  const ok = await verifyPasscode(parsed.data.passcode, row.passcode);
  if (!ok) {
    throw new HttpError(401, 'INVALID_PASSCODE', "That's not quite right. Try again 💛");
  }

  // Issue signed unlock cookie with the CURRENT passcode_version.
  const nowMs = Date.now();
  const payload = signPayload({
    kind: 'unlock',
    shortCode: row.short_code,
    passcodeVersion: row.passcode_version,
    iat: nowMs,
    exp: nowMs + UNLOCK_TTL_SEC * 1000,
  });

  // Atomic view-count bump with 30-min dedupe. Ignore any errors here — the
  // view metric is not safety-critical.
  await tryBumpViewCount(row.id).catch(() => undefined);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(unlockCookieName(row.short_code), payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: UNLOCK_TTL_SEC,
  });
  return res;
});

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return '0.0.0.0';
}
