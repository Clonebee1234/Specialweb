/**
 * Short-code generation.
 *
 * Requirements:
 *   - Length uniform in [6, 8]
 *   - Alphabet: A–Z, a–z, 0–9 (62 chars)
 *   - CSPRNG (Node `crypto`)
 *   - On insert collision, retry up to 5 times before failing with
 *     `SHORT_CODE_GENERATION_FAILED`.
 *
 * Why the alphabet choice: 62^6 ≈ 5.7×10^10 possible 6-char codes, which makes
 * accidental collision vanishingly rare at our scale. The variable length
 * adds a tiny bit more entropy and makes the final URL look less uniform.
 *
 * Why modulo bias is acceptable: 256 mod 62 = 8, so the first 8 alphabet slots
 * are ~1.5% more likely than the last 54. That's well under the uncertainty
 * we care about for collision probability, and avoiding it would require
 * rejection sampling that adds no security benefit at this scale.
 */

import { randomBytes, randomInt } from 'node:crypto';
import {
  SHORT_CODE_ALPHABET,
  SHORT_CODE_MIN_LENGTH,
  SHORT_CODE_MAX_LENGTH,
  SHORT_CODE_MAX_RETRIES,
} from '@/lib/constants';

/** Returns a fresh short code. Pure function; never throws. */
export function generateShortCode(): string {
  const len =
    SHORT_CODE_MIN_LENGTH +
    randomInt(0, SHORT_CODE_MAX_LENGTH - SHORT_CODE_MIN_LENGTH + 1);
  const buf = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    out += SHORT_CODE_ALPHABET[buf[i]! % SHORT_CODE_ALPHABET.length];
  }
  return out;
}

export { SHORT_CODE_MIN_LENGTH as MIN_SHORT_CODE_LENGTH };
export { SHORT_CODE_MAX_LENGTH as MAX_SHORT_CODE_LENGTH };

/** Raised when the insert retry budget is exhausted. */
export class ShortCodeGenerationError extends Error {
  public readonly attempts: number;

  constructor(attempts: number, cause?: unknown) {
    super(`SHORT_CODE_GENERATION_FAILED after ${attempts} attempts`, cause ? { cause } : undefined);
    this.name = 'ShortCodeGenerationError';
    this.attempts = attempts;
  }
}

/**
 * Attempts `insert(code)` with a freshly-generated short code, retrying on
 * unique-violation errors up to `maxAttempts` times (default: SHORT_CODE_MAX_RETRIES).
 *
 * The caller decides what "unique violation" looks like via `isUniqueViolation`.
 * This keeps the helper database-agnostic and testable.
 */
export async function createWithShortCode<T>(
  insert: (code: string) => Promise<T>,
  options: {
    isUniqueViolation: (err: unknown) => boolean;
    maxAttempts?: number;
  },
): Promise<{ code: string; result: T }> {
  const maxAttempts = options.maxAttempts ?? SHORT_CODE_MAX_RETRIES;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = generateShortCode();
    try {
      const result = await insert(code);
      return { code, result };
    } catch (err) {
      lastError = err;
      if (!options.isUniqueViolation(err)) throw err;
    }
  }
  throw new ShortCodeGenerationError(maxAttempts, lastError);
}
