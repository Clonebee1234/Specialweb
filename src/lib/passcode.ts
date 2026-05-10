/**
 * Passcode hashing and verification.
 *
 * Algorithm: Node's built-in `scrypt` (N=16384, r=8, p=1) with a 16-byte salt.
 * Output format: `scrypt$N$r$p$<salt-b64url>$<hash-b64url>`
 *
 * Why scrypt over bcrypt:
 *   - Ships in Node core (no native module risk on Vercel)
 *   - Memory-hard → meaningfully slower to brute-force on GPUs
 *
 * Why constant-time compare:
 *   - A timing side-channel on a 4-digit passcode is catastrophic; 10,000 codes
 *     is tiny enough that even microsecond-scale leaks let an attacker
 *     distinguish wrong guesses from server load.
 *
 * Used by:
 *   - POST /api/celebrations (hash the creator's chosen passcode)
 *   - POST /api/celebrations/:sc/unlock (verify recipient attempt)
 *   - POST /api/admin/celebrations/:id/reset-passcode (hash a fresh random 4-digit)
 *   - POST /api/admin/login (when ADMIN_PASSWORD_HASH is set)
 */

import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SCRYPT_PARAMS } from '@/lib/constants';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

export { SCRYPT_PARAMS };

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

/** Hashes a plaintext using scrypt + a fresh 16-byte salt. */
export async function hashPasscode(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(plain, salt, SCRYPT_PARAMS.keyLen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${b64url(salt)}$${b64url(hash)}`;
}

/**
 * Verifies a plaintext attempt against a stored hash.
 * Returns `true` iff the hashes match. Uses constant-time byte comparison.
 * Returns `false` on any parse error rather than throwing, so the unlock
 * endpoint can always respond with a uniform timing profile.
 */
export async function verifyPasscode(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6) return false;
    const [tag, nStr, rStr, pStr, saltB64, hashB64] = parts;
    if (tag !== 'scrypt') return false;
    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const salt = fromB64url(saltB64!);
    const stored_hash = fromB64url(hashB64!);
    const candidate = await scryptAsync(plain, salt, stored_hash.length, { N, r, p });
    if (candidate.length !== stored_hash.length) return false;
    return timingSafeEqual(candidate, stored_hash);
  } catch {
    return false;
  }
}

/** Generates a fresh 4-digit passcode, e.g. "0421". */
export function generateRandomPasscode(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}
