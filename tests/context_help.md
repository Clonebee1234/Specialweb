# `tests/`

Vitest + fast-check for unit and property-based tests. Playwright for end-to-end (scaffolded, specs to be filled in).

## Folders

- **`properties/`** — property-based tests (`*.pbt.ts`). Each file maps to one or more numbered properties from `.kiro/specs/celebrate-them/design.md` (section "Correctness Properties"). The top-of-file comment declares which properties are validated.
- **`unit/`** — example-based unit tests (placeholder; extend here as new pure logic lands).
- **`integration/`** — DB/storage integration tests that require a running Supabase (placeholder; the harness needs `supabase start` + a test bucket).
- **`e2e/`** — Playwright end-to-end flows (placeholder).
- **`setup.ts`** — shared Vitest setup (`@testing-library/jest-dom` matchers).

## Current property coverage

| Property | File | What it proves |
|---|---|---|
| 1 | `shortcode.pbt.ts` | Every generated short code is 6–8 chars from the documented alphabet. |
| 2 (pure variant) | `shortcode.pbt.ts` | 1000 pure generations produce ≥950 unique values. |
| 5 | `schema.pbt.ts` | The Zod schema rejects `activate_at < now+15m` and accepts everything beyond. |
| 14 | `passcode.pbt.ts` | `hashPasscode` + `verifyPasscode` round-trip is correct; mismatches and malformed hashes return `false` without throwing. |
| 16 | `cookie.pbt.ts` | Unlock cookie MAC survives valid signatures and rejects tampered ones. |
| 17 | `schema.pbt.ts` | Theme allowlist is enforced per type. |
| 18 | `schema.pbt.ts` | Birthday count ranges (reasons 5–10, photos 3–7) are enforced. |
| 19 | `schema.pbt.ts` | Expression count ranges (notices 3–5, photos 2–4) are enforced. |
| 20 | `gate.pbt.ts` | `lifecycle.gate` is total over 500 random inputs and respects the decision matrix. |
| 21 (cookie side) | `cookie.pbt.ts` | The verifier surfaces `passcodeVersion` so the caller can reject stale cookies. |
| 22 (adjacent) | `passcode.pbt.ts` | `generateRandomPasscode` always returns `^[0-9]{4}$`. |

## Adding a new property test

1. Pick the property from the design doc (or add one and document it there first).
2. Create `tests/properties/<topic>.pbt.ts`.
3. Top-of-file comment: `// Feature: celebrate-them, Property N: ...` and `// Validates: Requirements X.Y`.
4. Import `fc` from `fast-check`. Use `fc.assert(fc.property(...), { numRuns: 100 })` by default; go higher for cheap pure-function tests.
5. For modules that import `@/lib/env`, set every env var at the top of the file BEFORE importing (see `cookie.pbt.ts` for the pattern).
6. `npm test -- --run tests/properties` — must stay green.

## Why property-based tests matter here

The correctness spec (section 27 in `requirements.md`) is a list of invariants like "for all inserts, `expires_at = activate_at + 21h`". Example tests can only cover a handful of concrete cases; property tests sample the input space and shrink counter-examples automatically. They're the difference between "I think this works" and "the compiler says this works for every input I've thrown at it."
