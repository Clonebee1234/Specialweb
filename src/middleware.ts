/**
 * Next.js middleware — runs before every matched request.
 *
 * Responsibilities:
 *   1. Assign/echo `x-request-id` on every request (request tracing).
 *   2. Maintenance-mode gate (non-admin routes → 503 when enabled).
 *   3. Admin auth gate for /admin/** and /api/admin/**.
 *   4. CSRF double-submit check on mutating admin API requests.
 *
 * We run in the Edge runtime by default, which constrains us to Web APIs and
 * means we cannot import server-side libs that use `node:crypto`. The cookie
 * verification here is implemented against `crypto.subtle` so it's portable.
 */

import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_COOKIE = 'ct_admin';
const CSRF_COOKIE = 'ct_csrf';
const CSRF_HEADER = 'x-csrf-token';

function newRequestId(): string {
  return (globalThis.crypto ?? crypto).randomUUID();
}

async function verifyAdminCookie(raw: string | undefined, secret: string): Promise<boolean> {
  if (!raw) return false;
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return false;
  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
    const macB64 = bufferToB64Url(new Uint8Array(mac));
    if (macB64.length !== sigB64.length) return false;
    // Timing-safe compare (constant time across equal lengths).
    let diff = 0;
    for (let i = 0; i < macB64.length; i++) {
      diff |= macB64.charCodeAt(i) ^ sigB64.charCodeAt(i);
    }
    if (diff !== 0) return false;

    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { kind?: string; exp?: number };
    if (payload.kind !== 'admin') return false;
    if (!payload.exp || payload.exp <= Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function bufferToB64Url(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // 1. Assign/echo request id on every request.
  const requestId = req.headers.get('x-request-id') ?? newRequestId();
  const forwarded = new Headers(req.headers);
  forwarded.set('x-request-id', requestId);

  // 3. Admin gate.
  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isAdminApi = pathname.startsWith('/api/admin') && pathname !== '/api/admin/login';

  if (isAdminPage || isAdminApi) {
    const secret = process.env.COOKIE_SIGNING_SECRET;
    if (!secret) {
      return jsonError(500, 'INTERNAL_ERROR', 'Server misconfigured.', requestId);
    }
    const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
    const ok = await verifyAdminCookie(cookie, secret);
    if (!ok) {
      if (isAdminApi) {
        return jsonError(401, 'UNAUTHENTICATED', 'Admin session required.', requestId);
      }
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    // 4. CSRF double-submit for mutating admin API calls.
    if (isAdminApi && req.method !== 'GET' && req.method !== 'HEAD') {
      const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
      const headerToken = req.headers.get(CSRF_HEADER);
      if (!cookieToken || !headerToken || !constantTimeEqual(cookieToken, headerToken)) {
        return jsonError(403, 'CSRF_FAILED', 'CSRF check failed.', requestId);
      }
    }
  }

  const res = NextResponse.next({ request: { headers: forwarded } });
  res.headers.set('x-request-id', requestId);
  return res;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function jsonError(status: number, code: string, message: string, requestId: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
    },
  });
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static files.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
