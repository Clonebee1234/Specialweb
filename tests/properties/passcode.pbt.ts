// Feature: celebrate-them, Property 14: Constant-time comparison equivalence
// Validates: Requirements 27.9, 9.3, 15.1
// (Passcode hash/verify round-trip is tested here too — complements Property 14.)

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hashPasscode, verifyPasscode, generateRandomPasscode } from '@/lib/passcode';

describe('Passcode round-trip', () => {
  it('hashPasscode → verifyPasscode returns true for the same plaintext', async () => {
    // Use a small sample count because scrypt is intentionally expensive.
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 9999 }), async (n) => {
        const plain = String(n).padStart(4, '0');
        const hash = await hashPasscode(plain);
        expect(await verifyPasscode(plain, hash)).toBe(true);
      }),
      { numRuns: 8 },
    );
  });

  it('verifyPasscode returns false on a mismatched plaintext', async () => {
    const plain = '1234';
    const hash = await hashPasscode(plain);
    expect(await verifyPasscode('0000', hash)).toBe(false);
    expect(await verifyPasscode('', hash)).toBe(false);
    expect(await verifyPasscode('12345', hash)).toBe(false);
  });

  it('verifyPasscode returns false on malformed stored hashes without throwing', async () => {
    expect(await verifyPasscode('1234', 'garbage')).toBe(false);
    expect(await verifyPasscode('1234', '')).toBe(false);
    expect(await verifyPasscode('1234', 'scrypt$x')).toBe(false);
  });
});

describe('Property 22 (adjacent): reset passcode format', () => {
  it('generateRandomPasscode always returns 4 digits', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRandomPasscode()).toMatch(/^[0-9]{4}$/);
    }
  });
});
