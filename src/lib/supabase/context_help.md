# `src/lib/supabase/`

Two clients and a types file.

## Files

- **`server.ts`** — Service-role client. Reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `@/lib/env`. **Never import from a Client Component.** The service role bypasses RLS, so every caller must authenticate the request first (admin cookie, unlock cookie, cron header, or documented public path).
- **`browser.ts`** — Anon client. Safe to ship to the browser. Used only for direct public-storage reads; all DB mutations route through server API handlers.
- **`types.ts`** — Hand-written row types (`CelebrationRow`, `PhotoRow`, `QuizQuestion`, etc.) and the `Database` shape the Supabase clients accept.

## Why hand-written types?

Two reasons:
1. **CI independence.** `supabase gen types typescript` requires a live connection or a working local Supabase. Keeping the types in git means the typecheck never blocks on network or Docker.
2. **Stability.** Generated types sometimes churn on migration order or column-ordering details that don't affect the application. Hand-written types only change when the shape the app actually cares about changes.

If we ever need to regenerate: `npx supabase gen types typescript --linked > src/lib/supabase/types.ts` and diff it against the hand-written version.

## Security

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Next.js refuses to bundle `@/lib/env`'s server export into a Client Component; importing `@/lib/supabase/server` from a Client Component is an instant build failure.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public. That's fine — it only grants the permissions the bucket/table policies allow for anon.
