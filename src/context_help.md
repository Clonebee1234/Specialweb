# `src/` — source root

All application code lives here. Next.js 14 App Router reads `src/app/` as the routing tree (since `tsconfig.json` + `next.config.mjs` don't override the convention).

## Top-level map

- **`middleware.ts`** — runs in the Edge runtime on every matched request. Assigns/echoes `x-request-id`, gates `/admin/**` and `/api/admin/**` on the signed `ct_admin` cookie, enforces CSRF double-submit for mutating admin API calls.
- **`app/`** — Next.js routes (page components + API handlers).
- **`components/`** — React components grouped by surface (form, experience, admin).
- **`lib/`** — pure modules and framework-free utilities (env, time, crypto, Supabase clients, validation, constants).
- **`hooks/`** — client-only React hooks (empty placeholder today; future home for `useReducedMotion`, `useUnlock`, etc.).
- **`styles/`** — global CSS / theme files. Today the theme tokens live in `app/globals.css`; future per-theme CSS blocks will land here.
- **`types/`** — shared TypeScript types not bound to a specific module (placeholder).

## Architectural rules

1. **Server vs client boundary is explicit.** Files in `app/api/**` and anything importing `@/lib/supabase/server` or `@/lib/env` are server-only. Client Components (`'use client'`) may only import `@/lib/env`'s `publicEnv` export.
2. **Single source of truth for constants.** `src/lib/constants.ts` owns every magic number, enum, and user-facing message. Route handlers, UI, and tests all import from there.
3. **No `dangerouslySetInnerHTML`.** All user-supplied text renders through React's default JSX escaping.
4. **Typed all the way.** `tsconfig.json` is strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. The compiler is the first line of defence.

## Adding a new feature

1. Decide where it lives: a route (page or API), a shared module (lib), or a reusable component.
2. Add new constants to `lib/constants.ts` if any.
3. Update Zod schemas in `lib/validation/` if the payload changes.
4. Add property-based tests in `tests/properties/` for any new pure logic.
5. Run `npm run typecheck && npm test` before pushing.
