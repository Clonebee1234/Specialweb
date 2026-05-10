# `src/lib/` — framework-free building blocks

Everything here is intentionally independent of React and Next.js rendering. These modules are the "kernel" the API routes and UI sit on top of.

## Modules

| File | Role | Notes |
|---|---|---|
| `constants.ts` | Single source of truth for every magic number, enum, char-limit, rate limit, and user-facing message. | Imported by Zod schemas, routes, UI, and tests. Change it here once. |
| `env.ts` | Runtime-validated env loader (Zod). Splits into `env` (server-only) and `publicEnv` (client-safe). | Throws on invalid config in production. Logs a warning in dev. |
| `time.ts` | UTC time helpers with an injectable clock. | `nowUtc()`, `plusHours()`, `plusMinutes()`, `minutesFromNow()`, `isBefore()`, `parseIso()`. |
| `shortcode.ts` | CSPRNG short-code generator + retry-on-collision helper. | Alphabet + length live in `constants.ts`. |
| `passcode.ts` | scrypt hash/verify + random 4-digit generator. | Constant-time compare via `timingSafeEqual`. |
| `cookies.ts` | Signed cookie payloads (admin session + unlock cookie). | HMAC-SHA256. Unlock cookie embeds `{shortCode, passcodeVersion}` so admin reset invalidates all live sessions. |
| `csrf.ts` | Double-submit CSRF token helpers. | Used by admin login + middleware. |
| `rate-limit.ts` | Upstash Redis limiter (production) + in-memory fallback (dev-only). | Keys and windows declared in `constants.ts` via `RATE_LIMITS` + `RateLimitBuckets` factory. |
| `logger.ts` | `pino` structured logger with secret redaction. | Tags every log line with the current `request_id`. |
| `request-context.ts` | `AsyncLocalStorage` for per-request state (currently just `requestId`). | Set by `lib/api/handler.ts` wrapper; read by `logger.ts`. |
| `lifecycle.ts` | The pure gate function. Maps `(status, now, activate_at, expires_at)` → `LifecycleState`. | Total function, never throws. Property test in `tests/properties/gate.pbt.ts`. |

## Sub-folders

- **`lib/api/`** — route-handler wrapper with uniform error envelope + request-id tracing.
- **`lib/supabase/`** — server and browser clients. Service-role key is server-only.
- **`lib/validation/`** — Zod schemas for every API request body + admin list query.
- **`lib/db/`** — domain-layer functions (`celebrations`, `settings`, `storage`). Routes call these, not Supabase directly.
- **`lib/canvas/`** — pure `renderReplyImage` function + per-platform adapters (browser via `HTMLCanvasElement`, Node via `@napi-rs/canvas`).
- **`lib/state/`** — client-side Zustand stores (creator form).
- **`lib/client/`** — browser-only utilities (image compression).

## Decisions recorded

- **scrypt over bcrypt**: ships in Node core (no native-module risk on Vercel) and is memory-hard. Parameters (`N=16384, r=8, p=1`) sit in `constants.ts` so tests and tools agree.
- **Zustand + sessionStorage for creator form**: independent step slices + simple persistence. Context + reducer would re-render all consumers on every keystroke.
- **Upstash > in-memory in prod**: serverless functions don't share memory; in-memory is per-instance and unsafe. The env validator throws on prod boot if Upstash creds are missing.
- **Constant-time compare everywhere**: `timingSafeEqual` on byte buffers for passcode, admin password, and CSRF tokens. Length-mismatch is handled without early return.
