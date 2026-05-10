/** POST /api/admin/logout — clear the admin session + CSRF cookies. */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { ADMIN_COOKIE_NAME, CSRF_COOKIE_NAME } from '@/lib/cookies';

export const POST = apiHandler(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE_NAME);
  res.cookies.delete(CSRF_COOKIE_NAME);
  return res;
});
