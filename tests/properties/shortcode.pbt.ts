// Feature: celebrate-them, Property 1: Short code format
// Feature: celebrate-them, Property 2: Short code uniqueness under repeated calls (pure variant)
// Validates: Requirements 1.2, 27.2

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateShortCode } from '@/lib/shortcode';
import {
  SHORT_CODE_ALPHABET,
  SHORT_CODE_MIN_LENGTH,
  SHORT_CODE_MAX_LENGTH,
} from '@/lib/constants';

describe('Property 1: Short code format', () => {
  it('every generated code is 6..8 chars from the allowed alphabet', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), () => {
        const code = generateShortCode();
        expect(code.length).toBeGreaterThanOrEqual(SHORT_CODE_MIN_LENGTH);
        expect(code.length).toBeLessThanOrEqual(SHORT_CODE_MAX_LENGTH);
        for (const ch of code) {
          expect(SHORT_CODE_ALPHABET.includes(ch)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('Property 2 (pure variant): Short code uniqueness across small batches', () => {
  // Full uniqueness under DB inserts is covered by the integration suite. Here
  // we check that across a few-thousand pure generations we see vanishingly
  // few collisions — a quick sanity floor on entropy.
  it('1000 generations produce at least 950 unique values', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateShortCode());
    expect(set.size).toBeGreaterThanOrEqual(950);
  });
});
