/**
 * Rate limiter abstraction.
 *
 * Two implementations:
 *   - `UpstashLimiter` — REST-backed, shared across serverless instances.
 *     Production-required.
 *   - `InMemoryLimiter` — per-process Map. Dev-only; NOT safe across serverless
 *     instances. We log a warning and refuse to boot in production if Upstash
 *     creds are missing (see `lib/env.ts`).
 *
 * Keys follow a simple namespace convention:
 *   rl:unlock:{shortCode}:{ip}              10 / 15 min   (recipient unlock)
 *   rl:adminlogin:{ip}                      5 / 15 min    (admin login)
 *   rl:admin:reset-pc:{adminSessionId}      20 / 60 min   (admin passcode reset)
 */

import { env } from '@/lib/env';
import { RATE_LIMITS } from '@/lib/constants';

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (dev only)
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

class InMemoryLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      // Lazy cleanup: prune on write to avoid unbounded growth.
      if (this.buckets.size > 10_000) this.prune(now);
      return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    if (existing.count >= limit) {
      return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
    }
    existing.count += 1;
    return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
  }

  private prune(now: number): void {
    for (const [k, b] of this.buckets.entries()) {
      if (b.resetAt <= now) this.buckets.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Upstash implementation
// ---------------------------------------------------------------------------

class UpstashLimiter implements RateLimiter {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    // Fixed-window counter with an EXPIRE on first touch.
    // Atomic via pipelined INCR + EXPIRE (NX) in a single REST call.
    const body = [
      ['INCR', key],
      ['PEXPIRE', key, String(windowMs), 'NX'],
      ['PTTL', key],
    ];
    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      // Fail open rather than accidentally blocking the world on a transient
      // Upstash hiccup. Monitoring should catch the 5xx flood if this persists.
      return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    const json = (await response.json()) as Array<{ result?: number; error?: string }>;
    const count = typeof json[0]?.result === 'number' ? json[0].result : 1;
    const ttlMs = typeof json[2]?.result === 'number' ? json[2].result : windowMs;
    if (count > limit) {
      return { ok: false, remaining: 0, retryAfterMs: Math.max(0, ttlMs) };
    }
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
  }
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

let cached: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    cached = new UpstashLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  } else {
    cached = new InMemoryLimiter();
  }
  return cached;
}

// Canonical bucket factories so route handlers don't hand-roll keys.
export const RateLimitBuckets = {
  unlock: (shortCode: string, ip: string) => ({
    key: `rl:unlock:${shortCode}:${ip}`,
    limit: RATE_LIMITS.unlock.limit,
    windowMs: RATE_LIMITS.unlock.windowMs,
  }),
  adminLogin: (ip: string) => ({
    key: `rl:adminlogin:${ip}`,
    limit: RATE_LIMITS.adminLogin.limit,
    windowMs: RATE_LIMITS.adminLogin.windowMs,
  }),
  adminPasscodeReset: (adminSessionId: string) => ({
    key: `rl:admin:reset-pc:${adminSessionId}`,
    limit: RATE_LIMITS.adminPasscodeReset.limit,
    windowMs: RATE_LIMITS.adminPasscodeReset.windowMs,
  }),
} as const;
