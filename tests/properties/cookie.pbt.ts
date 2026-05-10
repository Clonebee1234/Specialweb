// Feature: celebrate-them, Property 16: Unlock cookie binds to its short code
// Feature: celebrate-them, Property 21: Passcode reset rotation (cookie side)
// Validates: Requirements 9.6, 9.8, 23.1, 23.2, 27.17, 31.4

import { describe, it, expect, beforeAll } from 'vitest';

// We must set the env BEFORE importing anything that reads `lib/env`.
(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.COOKIE_SIGNING_SECRET = 'test-cookie-secret-at-least-32-chars-long-xx';
process.env.CRON_SECRET = 'test-cron-secret-at-least-16';
process.env.ADMIN_PASSWORD = 'admin';

let signPayload: typeof import('@/lib/cookies').signPayload;
let verifySignedPayload: typeof import('@/lib/cookies').verifySignedPayload;

beforeAll(async () => {
  const mod = await import('@/lib/cookies');
  signPayload = mod.signPayload;
  verifySignedPayload = mod.verifySignedPayload;
});

describe('Property 16: Unlock cookie binds to its short code', () => {
  it('a cookie signed for shortCode A is accepted for A and still parses (caller verifies shortCode match)', () => {
    const aToken = signPayload({
      kind: 'unlock',
      shortCode: 'abc123',
      passcodeVersion: 1,
      iat: Date.now(),
      exp: Date.now() + 60_000,
    });
    const parsed = verifySignedPayload(aToken);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe('unlock');
    if (parsed?.kind === 'unlock') {
      expect(parsed.shortCode).toBe('abc123');
    }
  });

  it('a tampered cookie is rejected (MAC fails)', () => {
    const token = signPayload({
      kind: 'unlock',
      shortCode: 'abc123',
      passcodeVersion: 1,
      iat: Date.now(),
      exp: Date.now() + 60_000,
    });
    // Flip a byte in the signature portion.
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig!.slice(0, -1)}${sig!.slice(-1) === 'a' ? 'b' : 'a'}`;
    expect(verifySignedPayload(tampered)).toBeNull();
  });
});

describe('Property 21 (cookie side): stale passcode_version is caught by the caller', () => {
  it('verifier returns the embedded passcodeVersion so the caller can compare against the row', () => {
    const oldToken = signPayload({
      kind: 'unlock',
      shortCode: 'xYz789',
      passcodeVersion: 3,
      iat: Date.now(),
      exp: Date.now() + 60_000,
    });
    const parsed = verifySignedPayload(oldToken);
    expect(parsed).not.toBeNull();
    if (parsed?.kind === 'unlock') {
      expect(parsed.passcodeVersion).toBe(3);
      // After admin reset, row.passcode_version becomes 4 — the caller
      // compares and rejects. We don't hit a DB here; we just confirm the
      // version is surfaced.
      const rowVersion = 4;
      expect(parsed.passcodeVersion === rowVersion).toBe(false);
    }
  });
});
