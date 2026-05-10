# `src/lib/db/` — domain layer over Supabase

API routes never call the Supabase client directly. They call these helpers, which:
- narrow Supabase's permissive typing back to our hand-written row types,
- uniformize error handling (every Supabase error becomes `HttpError(500, 'DB_ERROR', ...)`),
- encode business rules that the schema alone can't (approval idempotence, storage rollback, etc.).

## Files

| File | Highlights |
|---|---|
| `celebrations.ts` | `findByShortCode`, `findById`, `insertCelebration`, `updateFields`, `updatePhotos`, `hardDeleteByShortCode`, `tryBumpViewCount` (RPC, 30-min dedupe), `approveIfPendingAndFresh` (handles all 5 branches of Req 28), `rejectIfPendingOrInactive`, `resetPasscode`, `extendExpiry` (with auto inactive→active flip + `times_reactivated` bump). |
| `settings.ts` | `readSettings`, `writeSetting` over the key/value `settings` table. |
| `storage.ts` | `createSignedUploadUrl`, `movePrefix` (with best-effort rollback), `deletePrefix`, `deleteObject`, `publicUrlFor`. Bucket name comes from `constants.STORAGE_BUCKET`. |

## Typing note

Supabase's TS client wants a very specific `Database` shape inferred from the CLI. We've opted to keep our own hand-written row types in `@/lib/supabase/types` and cast the client to `SupabaseClient<any, any, any>` inside each helper (scoped to a single `db()` function per file). The returned values are re-typed back to the domain row types before leaving the helper, so callers still get full typing.

## Approve/reject decision tables

Both `approveIfPendingAndFresh` and `rejectIfPendingOrInactive` return enough info for the route handler to pick the right HTTP response:

- Approve: `currentStatus === null` → 404. `currentStatus === 'active'` → 200 idempotent. `currentStatus === 'pending' && expires_at <= NOW()` → 409 `APPROVAL_WINDOW_ELAPSED`. `currentStatus === 'pending' && expires_at > NOW()` → 200 with new state.
- Reject: `row === null && !conflict` → 404. `conflict === 'active'` → 409 `CANNOT_REJECT_ACTIVE`. `conflict === 'deleted'` → 404. Otherwise 200 (pending → inactive, or inactive → 200 no-op with optional notes update).

## Concurrency

- `tryBumpViewCount` calls the SQL function `increment_view_count` (migration 0005) which encodes the 30-min dedupe in a single atomic UPDATE.
- Approve/reject/reset do a SELECT-then-UPDATE but the UPDATE's WHERE clause re-checks the expected current status, so concurrent admin operations collapse gracefully to a single winner.
- The Storage bucket's `move` operation is per-file; `movePrefix` best-effort reverts already-moved files if a later move fails.
