/**
 * POST /api/admin/login
 *
 * Constant-time password compare (hash if ADMIN_PASSWORD_HASH is set,
 * plaintext fallback via ADMIN_PASSWORD). Rate-limited 5/15m per IP with a
 * fixed 400ms delay on failure to mitigate timing attacks (Req 15.3).
 *
 * On success, issues `ct_admin` (HTTP-only) and `ct_csrf` (readable by JS)
 * cookies. Every mutating admin API request must echo `ct_csrf` as
 * `x-csrf-token` (double-submit).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { LoginSchema } from '@/lib/validation/admin';
import { getRateLimiter, RateLimitBuckets } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { verifyPasscode } from '@/lib/passcode';
import { readSettings } from '@/lib/db/settings';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SEC,
  CSRF_COOKIE_NAME,
  signPayload,
} from '@/lib/cookies';
import { generateCsrfToken } from '@/lib/csrf';

import { ADMIN_LOGIN_FAIL_DELAY_MS } from '@/lib/constants';

export const POST = apiHandler(async (req: NextRequest) => {
  const start = Date.now();
  
  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid JSON in request body');
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    await delayUntil(start + ADMIN_LOGIN_FAIL_DELAY_MS);
    throw new HttpError(400, 'VALIDATION_ERROR', 'Password is required');
  }

  // Rate limiting
  const ip = getClientIp(req);
  const bucket = RateLimitBuckets.adminLogin(ip);
  const rl = await getRateLimiter().consume(bucket.key, bucket.limit, bucket.windowMs);
  if (!rl.ok) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many login attempts. Please try again in a few minutes.');
  }

  const submitted = parsed.data.password;
  
  // Read settings from database
  let settings;
  try {
    settings = await readSettings();
  } catch (error) {
    throw new HttpError(500, 'DATABASE_ERROR', 'Failed to connect to database. Please check your Supabase configuration.');
  }

  // Verify password
  let ok = false;
  try {
    if (settings.admin_password_hash) {
      ok = await verifyPasscode(submitted, settings.admin_password_hash);
    } else if (env.ADMIN_PASSWORD_HASH) {
      ok = await verifyPasscode(submitted, env.ADMIN_PASSWORD_HASH);
    } else if (env.ADMIN_PASSWORD) {
      ok = constantTimeStringEq(submitted, env.ADMIN_PASSWORD);
    } else {
      throw new HttpError(500, 'CONFIG_ERROR', 'Admin password not configured. Please set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'AUTH_ERROR', 'Password verification failed');
  }

  if (!ok) {
    await delayUntil(start + ADMIN_LOGIN_FAIL_DELAY_MS);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid password');
  }

  // Generate session
  const now = Date.now();
  const sid = randomUUID();
  
  let adminCookie;
  try {
    adminCookie = signPayload({
      kind: 'admin',
      sid,
      iat: now,
      exp: now + ADMIN_SESSION_TTL_SEC * 1000,
    });
  } catch (error) {
    throw new HttpError(500, 'COOKIE_ERROR', 'Failed to generate session cookie. Please check COOKIE_SIGNING_SECRET is configured.');
  }

  const csrfToken = generateCsrfToken();

  const res = NextResponse.json({ ok: true, message: 'Login successful' });
  res.cookies.set(ADMIN_COOKIE_NAME, adminCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SEC,
  });
  res.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // client JS must read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SEC,
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

function constantTimeStringEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function delayUntil(targetMs: number): Promise<void> {
  const remaining = targetMs - Date.now();
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
}
