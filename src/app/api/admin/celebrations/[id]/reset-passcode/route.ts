/**
 * POST /api/admin/celebrations/[id]/reset-passcode
 *
 * Admin passcode reset (Req 31):
 *   - Generate fresh 4-digit plaintext via CSPRNG.
 *   - Rehash with scrypt and UPDATE `passcode` + bump `passcode_version`.
 *   - Return plaintext exactly once.
 *   - Rate-limited 20/60m per admin session id.
 *   - 404 on deleted/missing.
 *
 * Bumping `passcode_version` invalidates every outstanding unlock cookie
 * without us having to track them (cookies embed the version at issue time).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { generateRandomPasscode, hashPasscode } from '@/lib/passcode';
import { resetPasscode } from '@/lib/db/celebrations';
import { getRateLimiter, RateLimitBuckets } from '@/lib/rate-limit';
import { verifySignedPayload, ADMIN_COOKIE_NAME } from '@/lib/cookies';

export const POST = apiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  // Rate-limit key scoped to the admin session id so two operators aren't
  // sharing one bucket (useful if we later split admins).
  const adminCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value ?? '';
  const session = verifySignedPayload(adminCookie);
  const sid = session?.kind === 'admin' ? session.sid : 'unknown';

  const bucket = RateLimitBuckets.adminPasscodeReset(sid);
  const rl = await getRateLimiter().consume(bucket.key, bucket.limit, bucket.windowMs);
  if (!rl.ok) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many reset attempts. Please wait.');
  }

  const newPlaintext = generateRandomPasscode();
  const newHash = await hashPasscode(newPlaintext);

  const result = await resetPasscode(params.id, newHash);
  if (!result) {
    throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
  }

  // Return plaintext exactly once; never logged (see logger redact list).
  return NextResponse.json({
    passcode: newPlaintext,
    passcode_version: result.passcode_version,
  });
});
