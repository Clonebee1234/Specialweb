# Implementation Plan: CelebrateThem

## Overview

This plan takes an empty repository to a production-ready Next.js 14+ App Router application that implements every requirement (1–31) and design element of CelebrateThem: Supabase-backed passcode-protected celebrations, multi-step creator wizard with confirmation + Instagram contact, admin approval/rejection/reset-passcode workflow, full birthday and expression recipient experiences with seven chapters each, theming, audio, reply canvas, Vercel Cron expiry, rate limiting, observability, and security headers.

Tasks are ordered so each step builds on the previous and ends with wiring. Test tasks are marked with `*` and are optional; core implementation tasks are not. Every correctness property from the design gets a dedicated property-based test sub-task, placed close to its implementation. Each leaf task references the requirements it helps satisfy.

## Phase 1: Project Scaffolding and Tooling

- [x] 1. Initialize Next.js 14+ App Router project with TypeScript strict mode
  - Run `create-next-app` with App Router, TypeScript, Tailwind, and ESLint
  - Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` in `tsconfig.json`
  - Add path alias `@/*` mapped to `src/*`
  - (Req 22)

- [x] 1.1 Configure ESLint, Prettier, and editorconfig
  - Install `eslint-config-next`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`
  - Add Prettier with Tailwind plugin and a shared `.prettierrc`
  - Add `lint`, `lint:fix`, `format` npm scripts
  - (Req 22)

- [x] 1.2 Install Tailwind CSS with theme token plumbing
  - Configure `tailwind.config.ts` to read CSS variables for theme tokens
  - Add base layer styles and reset
  - (Req 22)

- [x] 1.3 Install test toolchain
  - Add Vitest, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `happy-dom`
  - Add `fast-check` for property-based tests
  - Add Playwright for e2e and install browsers
  - Add `@napi-rs/canvas` (or `node-canvas` fallback) for deterministic Canvas tests in Node
  - Create `vitest.config.ts` with `environment: 'jsdom'`, alias, and test setup file
  - Create `playwright.config.ts` with baseURL and the three projects (chromium-desktop, mobile-safari, reduced-motion)
  - (Req 22)

- [x] 1.4 Add npm scripts for the standard build pipeline
  - `typecheck`, `lint`, `test` (vitest run), `test:watch`, `test:pbt`, `test:integration`, `e2e`, `e2e:ui`, `build`, `start`
  - (Req 22)

- [ ] 1.5* Configure Husky + lint-staged pre-commit hook
  - Run `typecheck`, `lint`, and `test` on staged changes
  - (Req 22)

## Phase 2: Environment Configuration and Secrets

- [x] 2. Create `.env.example` documenting every variable in the design doc
  - Include: `NEXT_PUBLIC_APP_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_PASSWORD`, `ADMIN_PASSWORD_HASH`, `COOKIE_SIGNING_SECRET`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL`, `NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE`, `LOG_LEVEL`, `NODE_ENV`
  - Annotate server-only vs public vars
  - (Req 22, Req 25, Req 29)

- [x] 2.1 Implement `lib/env.ts` validated env loader
  - Zod schema that parses `process.env`, rejects missing server secrets in production
  - Emit a warning and refuse to start if Upstash creds missing when `NODE_ENV=production`
  - Export a typed `env` object
  - (Req 22, Req 25)

## Phase 3: Supabase Project, Storage Bucket, and Migrations

- [x] 3. Document Supabase project bootstrap steps in `README.md`
  - Steps to create the Supabase project, enable `pg_trgm`, create the `celebrations` Storage bucket, set public read policy on `celebrations/` and disallow list
  - (Req 7, Req 22)

- [x] 3.1 Add SQL migration `supabase/migrations/0001_init.sql`
  - `celebrations` table with every column from the design (id, short_code, passcode, passcode_version, type, status, theme, all common content, birthday-only, expression-only, expression_reply, expression_reply_downloaded, activate_at, expires_at, created_at, approved_at, approved_by, admin_notes, times_reactivated, last_viewed_at, view_count)
  - CHECK constraints: `short_code_format`, `temporal_order`, `approval_before_active`, `birthday_shape`, `expression_shape`, type/status enums
  - Indexes: short_code unique, status, expires_at, activate_at, composite `(status, type, activate_at DESC)`
  - (Req 1, Req 2, Req 3, Req 4, Req 5, Req 27)

- [x] 3.2 Add SQL migration `supabase/migrations/0002_pg_trgm.sql`
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm`
  - GIN trigram indexes on `lower(recipient_name)` and `lower(creator_name)`
  - (Req 16)

- [x] 3.3 Add SQL migration `supabase/migrations/0003_settings.sql`
  - `settings(key, value JSONB, updated_at)` table
  - Seed `default_activation_window_hours=21` and `maintenance_mode=false`
  - (Req 19)

- [x] 3.4 Add SQL migration `supabase/migrations/0004_window_trigger.sql`
  - `trg_celebrations_window()` plpgsql function enforcing: fixed 21h window on INSERT, immutable `activate_at`, monotonic `expires_at`
  - `BEFORE INSERT OR UPDATE` trigger wiring
  - (Req 27.1, Req 27.14, Req 5.5, Req 17.3)

- [x] 3.5 Add a local Supabase dev convenience (`supabase/config.toml` + scripts)
  - `db:reset`, `db:migrate`, `db:seed` npm scripts using Supabase CLI
  - (Req 22)

## Phase 4: Shared Library Modules

- [x] 4. Implement `lib/supabase/server.ts` and `lib/supabase/browser.ts`
  - Server client uses `SUPABASE_SERVICE_ROLE_KEY`, never imported from Client Components
  - Browser client uses anon key, typed with generated types
  - Generate `lib/supabase/types.ts` via Supabase CLI and commit
  - (Req 22, Req 25)

- [x] 4.1 Implement `lib/time.ts`
  - `nowUtc()`, `plusHours(ts, h)`, `isBefore(a, b)`, `minutesFromNow(n)`; all arguments/returns are ISO UTC strings or `Date`
  - Accept an injectable clock for testability
  - (Req 5, Req 10)

- [x] 4.2 Implement `lib/shortcode.ts`
  - `generateShortCode()` using `crypto.randomBytes` over `[A-Za-z0-9]`, length uniform in `[6,8]`
  - `createWithShortCode(insert)` helper that retries up to 5 times on unique-violation
  - (Req 1.2, Req 1.3, Req 27.2)

- [ ] 4.3* Write property-based test for short code format
  - **Property 1: Short code format** — forall invocations, length ∈ [6,8] and matches `^[A-Za-z0-9]+$`
  - **Validates: Requirements 27.2, 1.2**

- [ ] 4.4* Write property-based test for short code uniqueness
  - **Property 2: Short code uniqueness under repeated inserts** — for N ∈ [1,1000], distinct values
  - **Validates: Requirements 1.2, 27.2**

- [x] 4.5 Implement `lib/passcode.ts`
  - `hashPasscode(plain)` using Node `scrypt` (N=16384, r=8, p=1) with 16-byte salt; output encodes `scrypt$N$r$p$salt$hash`
  - `verifyPasscode(plain, stored)` with `crypto.timingSafeEqual`
  - (Req 1.4, Req 9.3, Req 27.9)

- [ ] 4.6* Write property-based test for constant-time comparison
  - **Property 14: Constant-time comparison equivalence** — timingSafeEqual vs `a.equals(b)` on equal-length buffers
  - **Validates: Requirements 27.9, 9.3, 15.1**

- [x] 4.7 Implement `lib/cookies.ts`
  - `signCookie(name, payload)` / `verifyCookie(name, raw)` using HMAC-SHA256 with `COOKIE_SIGNING_SECRET`
  - Unlock cookie payload embeds `shortCode` and `passcodeVersion`; verifier rejects mismatched name, bad MAC, or version mismatch
  - (Req 9.6, Req 9.8, Req 23.1, Req 23.2)

- [ ] 4.8* Write property-based test for unlock cookie short-code binding
  - **Property 16: Unlock cookie binds to its short code** — cookie for A accepted only for A, rejected for B
  - **Validates: Requirements 9.6, 23.1, 23.2**

- [x] 4.9 Implement `lib/rate-limit.ts`
  - Interface `RateLimiter.consume(key, limit, windowMs)` returning `{ ok, remaining, retryAfterMs }`
  - `UpstashLimiter` (REST), `InMemoryLimiter` (Map) with TTL cleanup; selector chooses based on env
  - Keys: `rl:unlock:{shortCode}:{ip}`, `rl:adminlogin:{ip}`, `rl:admin:reset-pc:{adminSessionId}`
  - (Req 9.5, Req 15.5, Req 31.6)

- [x] 4.10 Implement `lib/logger.ts`
  - `pino` logger with redaction for `passcode`, `replyText`, `expression_reply`, `service_role_key`, `COOKIE_SIGNING_SECRET`, `CRON_SECRET`, `authorization`, `cookie`
  - Tag every log line with `request_id` from AsyncLocalStorage context
  - (Req 24)

- [x] 4.11 Implement `lib/request-context.ts`
  - AsyncLocalStorage store holding `{ requestId }`
  - Helpers `runWithRequestContext(ctx, fn)` and `currentRequestId()`
  - (Req 24)

- [x] 4.12 Implement `lib/csrf.ts`
  - Issue `ct_csrf` token on admin login (double-submit pattern)
  - `verifyCsrf(req)` compares cookie value to `x-csrf-token` header in constant time; skip for GETs
  - (Req 23.5, Req 25)

- [x] 4.13 Implement `lib/api/handler.ts`
  - Wrapper that: attaches request id, enforces JSON content type, runs Zod validation, uniformizes error envelope `{ error: { code, message, details? } }`, echoes `x-request-id`
  - (Req 24.1, Req 24.4)

- [x] 4.14 Implement Zod schemas in `lib/validation/`
  - `createCelebration.ts` (full create payload with type-conditional branches, theme allowlist by type, passcode regex, activate_at ≥ now+15m)
  - `patchCelebration.ts` (admin edit — only editable fields)
  - `adminQuery.ts` (list filters/search/sort/pagination with activate_at range)
  - `approve.ts`, `reject.ts`, `resetPasscode.ts`, `unlock.ts`, `reply.ts`
  - (Req 1, Req 2, Req 3, Req 4, Req 5, Req 16, Req 17, Req 28, Req 31)

- [ ] 4.15* Write property-based test for theme allowlist by type
  - **Property 17: Theme allowlist by type** — schema accepts iff theme in allowed set for type
  - **Validates: Requirements 2.2, 2.3, 2.4**

- [ ] 4.16* Write property-based test for birthday content shape
  - **Property 18: Birthday content shape** — accept iff reasons∈[5,10], photos∈[3,7], quiz=5, correctIndex∈[0,3], within char limits
  - **Validates: Requirements 27.3, 3.1**

- [ ] 4.17* Write property-based test for expression content shape
  - **Property 19: Expression content shape** — accept iff things_i_notice∈[3,5], photos∈[2,4], confession∈[1,1500], closing∈[1,200]
  - **Validates: Requirements 27.4, 4.1**

- [ ] 4.18* Write property-based test for fifteen-minute minimum activation offset
  - **Property 5: Fifteen-minute minimum activation offset** — schema+server reject activate_at < now+15m with `ACTIVATE_AT_TOO_SOON`
  - **Validates: Requirements 27.13, 5.3**

- [x] 4.19 Implement `lib/lifecycle.ts` pure gate function
  - `gate({ status, now, activate_at, expires_at }) -> LifecycleStatus` returning `pending | pre_activation | active | ended | not_found`
  - Total function, never throws
  - (Req 10, Req 27)

- [ ] 4.20* Write property-based test for lifecycle gate totality
  - **Property 20: Lifecycle gate function totality** — forall valid inputs, returns exactly one LifecycleStatus, never throws
  - **Validates: Requirements 10.1–10.7**

- [x] 4.21 Implement `lib/canvas/replyImage.ts` pure PNG render function
  - Signature `renderReplyImage({ replyText, recipientFirstName, dateIso, theme }) -> Uint8Array`
  - Deterministic: fixed font metrics, no `Date.now()`, no `Math.random()`, explicit canvas size 1080x1350 (4:5)
  - Uses `@napi-rs/canvas` in Node and HTMLCanvasElement in browser via adapter
  - (Req 14, Req 27.10)

- [ ] 4.22* Write property-based test for reply image determinism
  - **Property 15: Reply image determinism** — two invocations with same inputs produce byte-identical PNGs (SHA-256 equal)
  - **Validates: Requirements 27.10, 14.2**

## Phase 5: Middleware and Security Headers

- [x] 5. Implement Next.js `middleware.ts`
  - Assign `x-request-id` header if absent, echo on response
  - Enforce maintenance-mode: for non-admin routes, return 503 page when `settings.maintenance_mode=true` (cached with short TTL)
  - Gate `/admin/**` (except `/admin/login`) and `/api/admin/**` on valid `ct_admin` cookie; redirect page routes to `/admin/login` and return 401 JSON for API routes
  - CSRF double-submit enforcement for mutating `/api/admin/**` requests
  - (Req 15.4, Req 19.2, Req 23.5, Req 24.4)

- [x] 5.1 Configure security headers in `next.config.mjs`
  - CSP (strict, no `unsafe-inline` for scripts; allow `'self'`, Supabase storage domain, Upstash if needed)
  - HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  - (Req 25)

## Phase 6: Public API Routes

- [x] 6. Implement `app/api/upload/photo/route.ts`
  - `POST` issues a Supabase-Storage signed upload URL scoped to `celebrations/tmp_{draftId}/photo_{index}.{ext}`
  - Validate MIME in `{image/jpeg, image/png, image/webp}`; reject 415 `UNSUPPORTED_PHOTO_TYPE`
  - Return `{ uploadUrl, publicUrl, path }`
  - (Req 7.3, Req 7.5)

- [x] 6.1 Implement `app/api/upload/audio/route.ts`
  - Same shape as photo; MIME in `{audio/mpeg, audio/mp4}`; declared max 5 MB
  - (Req 8.1, Req 8.2)

- [x] 6.2 Implement `app/api/celebrations/route.ts` `POST`
  - Validate with `CreateCelebrationSchema`
  - Enforce activate_at ≥ now+15m and theme-for-type
  - Hash passcode (scrypt), generate short code with retry
  - Move uploaded media from `tmp_{draftId}/` to `{shortCode}/` atomically; on failure, delete moved files and return 502 `PHOTO_UPLOAD_FAILED`
  - Insert row with `status='pending'`, `expires_at = activate_at + 21h`, all approval fields NULL
  - Return `{ shortCode, passcode, activate_at, expires_at }` exactly once
  - (Req 1, Req 2, Req 5, Req 7.4)

- [ ] 6.3* Write property-based test for initial persisted state
  - **Property 6: Initial state of persisted celebrations** — status='pending', approved_at NULL, approved_by NULL at insert
  - **Validates: Requirements 27.11, 1.1**

- [ ] 6.4* Write property-based test for fixed 21-hour window at persistence
  - **Property 4: Fixed 21-hour window at persistence** — forall inserts, expires_at = activate_at + 21h
  - **Validates: Requirements 27.14, 1.5, 5**

- [x] 6.5 Implement `app/api/celebrations/[shortCode]/status/route.ts` `GET`
  - Return `{ status: pending|pre_activation|active|ended|not_found, activate_at? }` using the shared `lifecycle.gate`
  - Never leak content or theme or activate_at outside `pre_activation`
  - (Req 10)

- [x] 6.6 Implement `app/api/celebrations/[shortCode]/unlock/route.ts` `POST`
  - Reject if status ≠ active or outside window (410 / 403 / 404)
  - Consume `rl:unlock:{shortCode}:{ip}` (10 / 15 min); 429 on exhaustion
  - `verifyPasscode` constant-time; 401 `INVALID_PASSCODE` on mismatch
  - On success, issue signed `ct_unlock_{shortCode}` cookie with `passcodeVersion` claim (24h)
  - Atomically increment `view_count` with 30-minute dedupe SQL
  - (Req 9, Req 20)

- [ ] 6.7* Write property-based test for concurrent view-count atomicity
  - **Property 13: Concurrent view-count atomicity** — N concurrent increments yield initial + N
  - **Validates: Requirements 27.8, 23.4, 20.1**

- [x] 6.8 Implement `app/api/celebrations/[shortCode]/content/route.ts` `GET`
  - Requires valid unlock cookie + current active window
  - Returns `CelebrationPublicPayload` (no passcode, no admin fields, no reply, no view_count)
  - (Req 10, Req 12, Req 13)

- [x] 6.9 Implement `app/api/celebrations/[shortCode]/reply/route.ts` `POST`
  - Requires unlock cookie, type='expression', status='active' within window
  - Trim and persist `expression_reply`; never log text
  - (Req 14.5, Req 14.8, Req 24.3)

## Phase 7: Admin API Routes

- [x] 7. Implement `app/api/admin/login/route.ts` `POST`
  - Rate limit 5/15m per IP; constant-time password compare (scrypt hash if `ADMIN_PASSWORD_HASH`, else env plaintext)
  - Issue `ct_admin` (HTTP-only, Secure, SameSite=Lax, 24h) and `ct_csrf` cookie
  - Fixed 400 ms delay on failure
  - (Req 15)

- [x] 7.1 Implement `app/api/admin/logout/route.ts` `POST`
  - Clear `ct_admin` and `ct_csrf`
  - (Req 15)

- [x] 7.2 Implement `app/api/admin/stats/route.ts` `GET`
  - Single SQL with `COUNT(*) FILTER (WHERE ...)` for active/pending/inactive/totalEverCreated/expiringNext2h
  - (Req 16)

- [x] 7.3 Implement `app/api/admin/celebrations/route.ts` `GET`
  - Parse `status`, `type`, `q`, `activateFrom`, `activateTo`, `sort`, `order`, `page`, `pageSize`
  - Query uses composite + trigram indexes; return `{ rows, page, pageSize, total }`
  - (Req 16, Req 30)

- [x] 7.4 Implement `app/api/admin/celebrations/[id]/route.ts` `GET` and `PATCH` and `DELETE`
  - `GET` returns full admin row plus computed `storage_bytes`
  - `PATCH` handles editable fields (content, theme, activate_at shift forward only via edit), status toggle (disabled when pending), and extend-expiry; enforced via Zod + trigger
  - `DELETE` performs permanent delete: remove Storage folder, hard-delete row; requires typed confirmation token in body
  - (Req 17, Req 18)

- [x] 7.5 Implement `app/api/admin/celebrations/[id]/approve/route.ts` `POST`
  - Atomic `UPDATE ... WHERE status='pending' AND expires_at > NOW() RETURNING ...`
  - Resolve branches: 404 not-found/deleted, 200 idempotent no-op on already-active, 409 `APPROVAL_WINDOW_ELAPSED` if pending and expired, 200 with new state on success
  - (Req 28)

- [ ] 7.6* Write property-based test for approval idempotence
  - **Property 11: Approval idempotence** — double-approve yields same (status, approved_at, approved_by) tuple
  - **Validates: Requirements 27.15, 28.4**

- [ ] 7.7* Write property-based test for active-implies-approved invariant
  - **Property 7: Active-implies-approved invariant** — status='active' ⇒ approved_at IS NOT NULL
  - **Validates: Requirements 27.12, 28.2**

- [x] 7.8 Implement `app/api/admin/celebrations/[id]/reject/route.ts` `POST`
  - Atomic update to `status='inactive'`, update `admin_notes` only when non-null supplied
  - (Req 28.5, Req 28.6)

- [ ] 7.9* Write property-based test for reject idempotence
  - **Property 12: Reject idempotence** — double-reject yields same (status, admin_notes)
  - **Validates: Requirements 27.16, 28.6**

- [ ] 7.10* Write property-based test for temporal ordering invariant across admin actions
  - **Property 3: Temporal ordering invariant** — forall reachable admin actions, expires_at > activate_at
  - **Validates: Requirements 27.1, 5.5, 17.3**

- [x] 7.11 Implement `app/api/admin/celebrations/[id]/photos/[idx]/route.ts` `DELETE`
  - Remove photo file in Storage and splice it out of `photos` JSONB preserving `order`
  - (Req 17)

- [x] 7.12 Implement `app/api/admin/celebrations/[id]/reply/mark-downloaded/route.ts` `POST`
  - Set `expression_reply_downloaded=TRUE`
  - (Req 18)

- [x] 7.13 Implement `app/api/admin/celebrations/[id]/reset-passcode/route.ts` `POST`
  - Rate limit 20/60m per admin session
  - Generate plaintext `String(crypto.randomInt(0, 10000)).padStart(4, '0')`
  - Atomic `UPDATE ... SET passcode=hash, passcode_version = passcode_version + 1 RETURNING ...`
  - Return plaintext exactly once
  - (Req 31)

- [ ] 7.14* Write property-based test for passcode reset format
  - **Property 22: Passcode reset format** — plaintext matches `^[0-9]{4}$`
  - **Validates: Requirement 27.18, 31**

- [ ] 7.15* Write property-based test for passcode reset rotation
  - **Property 21: Passcode reset rotation** — post-version = pre-version + 1; pre-reset cookie rejected after reset
  - **Validates: Requirements 27.17, 31.1, 31.4, 9.8**

- [ ] 7.16 Implement `app/api/admin/settings/route.ts` `GET` and `PATCH`
  - `GET` returns `default_activation_window_hours`, `maintenance_mode`, computed storage usage
  - `PATCH` updates settings; validates bounds and types
  - (Req 19)

- [ ] 7.17 Checkpoint - Ensure all Phase 6 and Phase 7 tests pass
  - Run `npm run typecheck && npm run lint && npm test`. Ensure all tests pass, ask the user if questions arise.

## Phase 8: Cron and Vercel Config

- [x] 8. Implement `app/api/cron/expire/route.ts`
  - Require `x-cron-secret` equal to `CRON_SECRET`; 401 otherwise with no DB writes
  - Single SQL: `UPDATE celebrations SET status='inactive' WHERE status='active' AND expires_at < NOW()`
  - Never touches pending/inactive/deleted; never deletes files
  - (Req 11)

- [ ] 8.1* Write property-based test for expiry job idempotence
  - **Property 10: Expiry job idempotence** — running twice yields same final state as once
  - **Validates: Requirements 27.7, 11.2**

- [x] 8.2 Create `vercel.json` cron binding
  - Schedule `/api/cron/expire` hourly (`0 * * * *`)
  - Function config: nodejs runtime, region pinned to primary
  - (Req 11.5)

## Phase 9: Creator Form UI

- [ ] 9. Implement `store/createForm.ts` (Zustand + persist sessionStorage)
  - Slices: occasion, basics, theme, birthdayContent, expressionContent, timing, media
  - Selectors per step; `reset()`; draft token `shortCodeDraft` generated on mount
  - (Req 6)

- [x] 9.1 Implement `app/create/page.tsx` shell and `CreatorWizard` client component
  - Step router using `step` query param; desktop split-preview layout
  - Progress indicator
  - (Req 6)

- [x] 9.2 Implement `StepOccasion` (auto-advance on select)
  - (Req 2.1)

- [x] 9.3 Implement `StepBasics` (recipient_name, creator_name, relationship)
  - react-hook-form + zodResolver mirroring `lib/validation/createCelebration.ts`
  - (Req 3, Req 4)

- [x] 9.4 Implement `StepTheme` with per-type allowlist preview swatches
  - (Req 2.2, Req 2.3, Req 2.4)

- [x] 9.5 Implement `StepContent` with `BirthdayContentFields` branch
  - `hero_text`, `reasons` (5–10), `quiz_questions` (exactly 5 with 4 options + correctIndex), `final_message`
  - Field-level validation errors that block step advancement
  - (Req 3)

- [x] 9.6 Implement `StepContent` `ExpressionContentFields` branch
  - `confession_message`, `things_i_notice` (3–5), `closing_line` (preset or custom)
  - (Req 4)

- [x] 9.7 Implement photo uploader with client-side compression
  - Compress to JPEG/WebP ≤ 1 MB with up to 3 iterative quality reductions
  - Reject with "This image is too large..." after 3 attempts
  - Enforce MIME allowlist client-side and max count (7 birthday / 4 expression)
  - (Req 7)

- [x] 9.8 Implement audio uploader
  - MIME allowlist (audio/mpeg, audio/mp4); 5 MB cap client-side
  - (Req 8.1, Req 8.2)

- [x] 9.9 Implement upload manifest orchestrator
  - Request signed URLs, PUT media directly to Storage, track progress
  - On any failure, abort and surface error state
  - (Req 7.4)

- [x] 9.10 Implement `StepSecurityAndTiming`
  - Two identical 4-digit passcode fields matching `^[0-9]{4}$`
  - Local datetime picker with server-time-aware 15-minute minimum
  - Live preview of `expires_at = activate_at + 21 h` in local timezone
  - (Req 5)

- [x] 9.11 Implement `StepPreview`
  - Render `RecipientExperiencePreview` in-memory against form data; no persistence
  - (Req 6.3)

- [x] 9.12 Wire "Generate My Link" submission
  - POST `/api/celebrations`, route to confirmation on 201
  - Surface 400 field-level errors back into the wizard step
  - (Req 1, Req 6.4)

## Phase 10: Post-Submission Confirmation Screen

- [x] 10. Implement `app/create/confirmation/page.tsx`
  - "Awaiting approval" banner with explicit copy "Please message our admin to approve your request"
  - Render link `https://{host}/c/{shortCode}` and the plaintext Passcode with copy-to-clipboard buttons for each
  - Instagram contact block driven by `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL` + `NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE`, with fallback copy when unset
  - Pre-filled message template including approval-request phrase, link, and passcode with a "Copy message" button
  - State source: route params / sessionStorage one-time payload; clear after display
  - (Req 1.7, Req 29)

## Phase 11: Recipient Experience Shell

- [ ] 11. Implement `app/c/[shortCode]/page.tsx` server component
  - Server-side call to `lifecycle.gate` using DB row; render one of: NotFound (404), PendingGate, PreActivationGate (shows formatted activate_at), EndedGate, or pass through to client experience
  - No celebration content leaked for pending/pre_activation/ended/404
  - (Req 10)

- [x] 11.1 Implement client `ExperienceBoundary` mounted on active
  - Calls `/api/celebrations/{shortCode}/status`, then `PasscodeEntry` or fetches `/content` when unlock cookie present
  - (Req 9.7, Req 10.1)

- [x] 11.2 Implement `PasscodeEntry`
  - Auto-submit on 4 digits entered; shake animation on 401 with "That's not quite right. Try again 💛"
  - Surface 429 "Too many attempts. Please try again later."
  - (Req 9)

- [x] 11.3 Implement `AudioPlayer` persistent bottom-left control
  - Play/Pause, Mute/Unmute, volume slider; initial volume ≤ 0.4; autoplay attempt
  - Render "Tap to play music" affordance if autoplay blocked
  - Hide entirely when `song_url` is null
  - (Req 8)

- [ ] 11.4 Implement `ProgressIndicator` for chapter navigation
  - Shared across birthday and expression experiences
  - (Req 12, Req 13)

## Phase 12: Birthday Experience Chapters

- [ ] 12. Implement `BirthdayExperience` shell + code-split chapter registry
  - Each chapter lazy-loaded via `next/dynamic` so expression code never ships on birthday path
  - (Req 12.1, Req 22)

- [ ] 12.1 Implement `ChapterUnwrapping`
  - Tap-to-unwrap gift with ribbon + confetti burst
  - (Req 12.1)

- [ ] 12.2 Implement `ChapterCinematicReveal` with GSAP SplitText
  - Letter-by-letter `recipient_name`, then "Happy Birthday!", then "From {creator_name}, with all my heart"
  - (Req 12.2)

- [ ] 12.3 Implement `ChapterStoryScroll` with GSAP ScrollTrigger parallax
  - `hero_text` first, then each photo in stored order with captions
  - (Req 12.3)

- [ ] 12.4 Implement `ChapterReasonsConstellation`
  - SVG draw-on animation, renders every `reasons` entry in order, no drops
  - (Req 12.4)

- [ ] 12.5 Implement `ChapterQuiz`
  - 5 questions in stored order, correctness feedback, 2s on correct / 3s on incorrect auto-advance
  - Score 0–5 screen with preset messages
  - (Req 12.5, Req 12.6)

- [ ] 12.6 Implement `ChapterUnwrapWishes`
  - 6–8 boxes from shuffled `reasons` + 2–3 auto wishes; revealed boxes stay revealed
  - (Req 12.7)

- [ ] 12.7 Implement `ChapterCelebrationWheel`
  - Exactly 3 spins with counter; prompts pulled from predefined set with `{creator_name}` interpolation
  - (Req 12.8)

- [ ] 12.8 Implement `ChapterFinalLetter`
  - Typewriter ~30 cps preserving line breaks
  - (Req 12.9)

- [ ] 12.9 Implement `ChapterGrandFinale`
  - Multi-burst confetti on entry, gentle confetti while in section, closing message
  - (Req 12.10)

## Phase 13: Expression Experience Chapters

- [ ] 13. Implement `ExpressionExperience` shell + code-split chapter registry
  - (Req 13.1, Req 22)

- [ ] 13.1 Implement `ChapterEnvelope`
  - Tap-to-open envelope with wax seal
  - (Req 13.1)

- [ ] 13.2 Implement `ChapterSlowBuild`
  - 4 texts with ≥2s holds between: `{recipient_name}...`, thinking-line, "So I made this for you.", "Scroll when you're ready."
  - (Req 13.2)

- [ ] 13.3 Implement `ChapterNoticing`
  - 1 notice per viewport height, stored order
  - (Req 13.3)

- [ ] 13.4 Implement `ChapterMoments`
  - Ken Burns over ≥5 seconds per photo, caption rendered when present
  - (Req 13.4)

- [ ] 13.5 Implement `ChapterConfession`
  - Typewriter ~25 cps; after 3s hold, signature `— {creator_name}`; then `closing_line`
  - (Req 13.5)

- [ ] 13.6 Implement `ChapterReply` hosting `ReplyCanvas`
  - 200-char input with counter; on submit render 4:5 PNG with `renderReplyImage` and theme styling
  - Buttons: "Download this image", "I'd like {creator_name} to receive this", "Skip"
  - Download triggers browser download only; send hits `/api/celebrations/{shortCode}/reply`; skip advances with no store
  - On send failure: "We couldn't save your reply. Please try again." with retained text
  - (Req 14)

- [ ] 13.7 Implement `ChapterSoftEnding`
  - No confetti; gentle closing
  - (Req 13.6, Req 14.7)

## Phase 14: Theme Tokens, Fonts, and Reduced Motion

- [ ] 14. Implement theme token CSS in `styles/themes/`
  - 7 themes via CSS variables: `confetti-burst`, `golden-glow`, `neon-night`, `starry-dream`, `midnight-letters`, `soft-bloom`, `warm-sunset`
  - Apply theme class on experience root
  - (Req 21)

- [ ] 14.1 Implement font loading strategy via `next/font`
  - Per-theme font stacks; `display: swap`; subset by latin
  - (Req 21, Req 22)

- [ ] 14.2 Implement reduced-motion substitutions
  - `prefers-reduced-motion: reduce` disables confetti, GSAP motion, Ken Burns, typewriter pacing > 60 cps, wheel spin animation; replaces with cross-fades and static reveals
  - Shared hook `useReducedMotion()`; applied in every chapter
  - (Req 26)

## Phase 15: Admin Panel UI

- [ ] 15. Implement `app/admin/login/page.tsx`
  - Password form, handles 401/429, uses CSRF cookie flow on success
  - (Req 15)

- [x] 15.1 Implement `app/admin/page.tsx` dashboard
  - Stats cards incl. Pending approval count and recent activity feed
  - (Req 16)

- [ ] 15.2 Implement `app/admin/pending/page.tsx`
  - Filtered list of pending celebrations with quick Approve/Reject actions
  - (Req 28, Req 30)

- [x] 15.3 Implement `app/admin/celebrations/page.tsx` list
  - Columns: Short_Code, Type icon, Recipient, Creator, Relationship, Status, Created, Activate At, Expires At, Approved At, Views, Actions
  - `RowActions` cluster (view, approve/reject when pending, toggle, extend, edit, reset passcode, permanent delete)
  - Filters: status, type, activate_at range, search (trigram), sort, pagination
  - (Req 16, Req 17, Req 30)

- [x] 15.4 Implement `app/admin/celebrations/[id]/page.tsx` detail
  - Pending banner with Approve/Reject (disabled after transition)
  - Status toggle disabled on pending; Extend expiry control; Edit content; per-photo delete
  - Permanent delete modal with typed confirmation
  - Reply viewer with `renderReplyImage` preview, download, and "Mark downloaded"
  - (Req 17, Req 18, Req 28)

- [x] 15.5 Implement `ResetPasscodeModal`
  - Calls reset endpoint, reveals plaintext once, copy button, dismiss clears from memory
  - (Req 31)

- [x] 15.6 Implement `app/admin/settings/page.tsx`
  - Edit `default_activation_window_hours` (future-facing only), `maintenance_mode` toggle
  - Storage usage panel; change password form (writes `ADMIN_PASSWORD_HASH` settings row)
  - (Req 19)

- [ ] 15.7 Checkpoint - Ensure admin panel and recipient shell work end-to-end
  - Run `npm run typecheck && npm run lint && npm test`. Ensure all tests pass, ask the user if questions arise.

## Phase 16: Observability

- [ ] 16. Wire structured logging into every route handler
  - Use `lib/api/handler.ts` wrapper; log route, request id, duration, status; redact per `lib/logger.ts`
  - (Req 24)

- [ ] 16.1 Wire request-id tracing via AsyncLocalStorage
  - Middleware puts `requestId` into context; every `logger.info` auto-tags
  - (Req 24.4)

- [ ] 16.2 Add Lighthouse CI config with FCP budget
  - `lighthouserc.json` asserting FCP ≤ budget on the recipient route
  - (Req 22)

- [ ] 16.3 Add bundle-size gate
  - `size-limit` config: ≤ 250 KB gzip per experience entrypoint; fail CI if exceeded
  - (Req 22)

## Phase 17: Testing

- [ ] 17. Set up integration test harness
  - Local Supabase via `supabase start`; per-test `TRUNCATE TABLE celebrations RESTART IDENTITY`
  - Dedicated Storage bucket `ct-test`; teardown purges prefix
  - Shared `setupIntegration.ts` test helper
  - (Req 22)

- [ ] 17.1* Write property-based tests for Photos and Quiz JSONB round-trips
  - **Property 8: Photos JSONB round-trip** — write/read equals P sorted by `order`. **Validates: 27.5, 7.3**
  - **Property 9: Quiz questions JSONB round-trip** — write/read preserves options and correctIndex. **Validates: 27.6, 3.1**

- [ ] 17.2* Write canvas determinism test
  - **Property 15 re-check** using `@napi-rs/canvas` in vitest node env; compare SHA-256 of two renders
  - **Validates: 27.10, 14.2**

- [ ] 17.3* Write unit tests for example-based cases called out in design
  - Lifecycle gate matrix, theme allowlist matrix, shortcode alphabet edge cases, scrypt verify round-trip
  - (Req 10, Req 2, Req 1, Req 27)

- [ ] 17.4* Write Playwright e2e: creator happy path (birthday)
  - Fill wizard, generate link, see confirmation with Instagram block and copy buttons
  - (Req 1, Req 6, Req 29)

- [ ] 17.5* Write Playwright e2e: admin approval flow
  - Login, approve a pending celebration, verify `/c/{shortCode}` transitions
  - (Req 15, Req 28)

- [ ] 17.6* Write Playwright e2e: recipient happy path (both types)
  - Pre-seed DB, enter passcode, progress through chapters, download reply image
  - (Req 9, Req 10, Req 12, Req 13, Req 14)

- [ ] 17.7* Write Playwright e2e: reduced-motion substitution
  - Set `prefersReducedMotion: reduce`, verify no confetti/GSAP transforms fire
  - (Req 26)

- [ ] 17.8* Write Playwright e2e: passcode reset invalidates cookies
  - Unlock with old passcode, admin resets, re-request should show passcode screen
  - (Req 9.8, Req 31)

- [ ] 17.9 Checkpoint - Ensure all tests pass
  - Run full suite: `npm run typecheck && npm run lint && npm test && npm run test:integration && npm run e2e`. Ensure all tests pass, ask the user if questions arise.

## Phase 18: CI/CD

- [ ] 18. Add GitHub Actions workflow `.github/workflows/ci.yml`
  - Jobs: typecheck, lint, unit+PBT tests, integration tests (supabase service container), e2e smoke, bundle-size check, Lighthouse CI
  - Upload Playwright + Lighthouse artifacts
  - (Req 22)

- [ ] 18.1 Configure Vercel deployment
  - Link project, set all env vars from `.env.example`, configure the cron binding from `vercel.json`
  - Startup log check: fail boot if `UPSTASH_REDIS_REST_URL`/`TOKEN` missing in production
  - (Req 11, Req 22, Req 25)

## Phase 19: Production Readiness

- [ ] 19. Run final security audit checklist
  - Validate CSP (no `unsafe-inline` scripts, allowlist only required origins)
  - Scan repo and logs for secret leakage (`passcode`, service role key, cookie secret)
  - Verify HTTPS/HSTS at edge; `X-Frame-Options: DENY`
  - Grep codebase to confirm no `dangerouslySetInnerHTML` usage
  - Verify React escape-on-render for every creator-supplied text field
  - (Req 23, Req 25)

- [ ] 19.1 Configure production env vars
  - Set `ADMIN_PASSWORD_HASH`, `COOKIE_SIGNING_SECRET`, `CRON_SECRET`, Upstash creds, Supabase keys, `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL`, `NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE`
  - (Req 15, Req 22, Req 29)

- [ ] 19.2 Seed initial settings row
  - `default_activation_window_hours=21`, `maintenance_mode=false`
  - (Req 19)

- [ ] 19.3 Smoke test approve + reset-passcode end-to-end in production
  - Create test celebration, approve via admin, unlock, reset passcode, confirm old cookie rejected, clean up via permanent delete
  - (Req 15, Req 28, Req 31)

- [ ] 19.4 Final checkpoint - Production readiness verified
  - Ensure all tests pass and all checklist items are green, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP; core implementation tasks are not marked optional.
- Every numbered correctness property from the design has a dedicated property-based test sub-task, placed close to the implementation it validates: Property 1 (4.3), Property 2 (4.4), Property 3 (7.10), Property 4 (6.4), Property 5 (4.18), Property 6 (6.3), Property 7 (7.7), Property 8 (17.1), Property 9 (17.1), Property 10 (8.1), Property 11 (7.6), Property 12 (7.9), Property 13 (6.7), Property 14 (4.6), Property 15 (4.22, re-checked 17.2), Property 16 (4.8), Property 17 (4.15), Property 18 (4.16), Property 19 (4.17), Property 20 (4.20), Property 21 (7.15), Property 22 (7.14).
- Each task references specific requirements for traceability.
- Checkpoints validate incrementally at the end of Phase 7, 15, 17, and 19.
