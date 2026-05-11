/**
 * GET /api/admin/debug
 * 
 * Temporary debug endpoint to check if environment variables are set.
 * DELETE THIS FILE after debugging or before going to production.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    environment: process.env.NODE_ENV,
    hasCookieSecret: !!process.env.COOKIE_SIGNING_SECRET,
    cookieSecretLength: process.env.COOKIE_SIGNING_SECRET?.length || 0,
    hasAdminPassword: !!process.env.ADMIN_PASSWORD,
    hasAdminPasswordHash: !!process.env.ADMIN_PASSWORD_HASH,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    supabaseUrl: process.env.SUPABASE_URL ? 'configured' : 'missing',
    hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'missing',
  };

  return NextResponse.json(checks);
}
