/**
 * CSRF double-submit pattern for admin mutations.
 *
 * Flow:
 *   1. On /api/admin/login, we set BOTH `ct_admin` (HTTP-only) and `ct_csrf`
 *      (readable by JS). The csrf token is 32 random bytes, base64url.
 *   2. The admin UI reads `ct_csrf` from `document.cookie` and echoes it as
 *      the `x-csrf-token` header on every mutating request.
 *   3. Middleware verifies `header === cookie` in constant time; reject with
 *      `403 CSRF_FAILED` on mismatch.
 *
 * SameSite=Lax already blocks cross-site POSTs from triggering, but the token
 * check protects against same-site XSS or bookmarklet abuse.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function verifyCsrf(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken, 'utf8');
  const b = Buffer.from(headerToken, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
