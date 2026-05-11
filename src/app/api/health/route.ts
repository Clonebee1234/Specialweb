/**
 * GET /api/health
 * 
 * Health check endpoint for monitoring and debugging.
 * Returns 200 if the app is running and can connect to the database.
 */

import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Test database connection
    const db = getSupabaseServer();
    const { error } = await db.from('settings').select('key').limit(1);
    
    if (error) {
      return NextResponse.json(
        { 
          status: 'unhealthy', 
          error: 'Database connection failed',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
