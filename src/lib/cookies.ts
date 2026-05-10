/**
 * Signed cookie helpers — used for both the admin session cookie (`ct_admin`)
 * and the per-celebration unlock cookie (`ct_unlock_{shortCode}`).
 *
 * Format: `base64url(json-payload).base64url(hmac-sha256)`
 *
 * The HMAC binds the payload to our `COOKIE_SIGNING_SECRET`. Rotating the
 * secret invalidates every live cookie, which is the desired panic button.
 *
 * The unlock cookie's payload carries `{ shortCode, passcodeVersion, exp }`.
 * On every request we re-check both:
 *   1. that the claim's `shortCode` matches the URL path, AND
 *   2. that the claim's `passcodeVersion` matches the row's current version.
 *
 * (2) is how the admin passcode-reset action invalidates every live unlock
 * session atomically, without us having to track them all.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SEC,
  CSRF_COOKIE_NAME,
  UNLOCK_TTL_SEC,
} from '@/lib/constants';

export {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SEC,
  CSRF_COOKIE_NAME,
  UNLOCK_TTL_SEC,
};

type AdminSessionPayload = {
  kind: 'admin';
  iat: number;
  exp: number;
  sid: string;
};

type UnlockPayload = {
  kind: 'unlock';
  shortCode: string;
  passcodeVersion: number;
  iat: number;
  exp: number;
};

export type CookiePayload = AdminSessionPayload | UnlockPayload;

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sign(payloadB64: string): string {
  const mac = createHmac('sha256', env.COOKIE_SIGNING_SECRET);
  mac.update(payloadB64);
  return b64url(mac.digest());
}

/** Serializes + signs a payload. Used when issuing a new cookie. */
export function signPayload<T extends CookiePayload>(payload: T): string {
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  const sigB64 = sign(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies the MAC and returns the parsed payload, or `null` for any failure.
 * Never throws. The caller is still responsible for business-level checks:
 *   - `exp` vs now
 *   - `shortCode` vs the URL path (for unlock cookies)
 *   - `passcodeVersion` vs the row's current version (for unlock cookies)
 */
export function verifySignedPayload(raw: string): CookiePayload | null {
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return null;
  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  const expectedSig = Buffer.from(sign(payloadB64), 'base64url');
  const actualSig = Buffer.from(sigB64, 'base64url');
  if (expectedSig.length !== actualSig.length) return null;
  if (!timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as CookiePayload;
    if (parsed.kind !== 'admin' && parsed.kind !== 'unlock') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True iff `payload.exp` is strictly after `nowMs`. */
export function isFresh(payload: CookiePayload, nowMs: number): boolean {
  return payload.exp > nowMs;
}

export function unlockCookieName(shortCode: string): string {
  // Path-only scope; the cookie itself is further signed and short-code-bound.
  return `ct_unlock_${shortCode}`;
}
