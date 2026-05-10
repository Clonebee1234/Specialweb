/**
 * Runtime-validated environment variables.
 *
 * Why: Next.js hands you `process.env.FOO` as `string | undefined` with no
 * guarantees. We parse once at module load, fail loud on invalid configuration
 * (especially in production), and export a typed `env` object everything else
 * can import with confidence.
 *
 * This file must only be imported from server-side code. The NEXT_PUBLIC_*
 * variables are re-exported via `publicEnv` which is safe to import anywhere.
 */

import { z } from 'zod';

const nonEmpty = z.string().min(1);

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  SUPABASE_URL: nonEmpty.url(),
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,

  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),

  COOKIE_SIGNING_SECRET: z.string().min(32, 'COOKIE_SIGNING_SECRET must be at least 32 characters'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),

  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: nonEmpty.url(),
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  NEXT_PUBLIC_ADMIN_INSTAGRAM_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE: z.string().optional(),
});

function parseOrThrow<T extends z.ZodTypeAny>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}

/**
 * Server-only env. Do NOT import from a Client Component; Next.js will try to
 * ship the whole module into the client bundle and the build will fail (or
 * worse, leak secrets).
 */
export const env = parseOrThrow(serverSchema, process.env);

/**
 * Public env. Safe to import from anywhere, including Client Components.
 * These values are also embedded into the client bundle at build time.
 */
export const publicEnv = parseOrThrow(publicSchema, process.env);

/**
 * Production guard: Upstash credentials are required in production because the
 * in-memory rate limiter doesn't share state across serverless invocations.
 * We warn aggressively in dev and throw in prod.
 */
if (env.NODE_ENV === 'production') {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production ' +
        'because the in-memory rate limiter is unsafe across serverless instances.',
    );
  }
  if (!env.ADMIN_PASSWORD && !env.ADMIN_PASSWORD_HASH) {
    throw new Error('Either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH must be set in production.');
  }
} else if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] Upstash credentials not set — falling back to in-memory rate limiter (dev only).',
  );
}

export type Env = typeof env;
export type PublicEnv = typeof publicEnv;
