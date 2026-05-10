# `supabase/`

Schema migrations and local-dev config for the Supabase CLI.

## Files

- **`config.toml`** — minimal local-dev config (Postgres on :54322, Studio on :54323). Used by `npx supabase start`.
- **`migrations/0001_init.sql`** — creates the `celebrations` table with every column, CHECK constraint (`short_code_format`, `temporal_order`, `approval_before_active`, `birthday_shape`, `expression_shape`), and composite + single-column indexes.
- **`migrations/0002_pg_trgm.sql`** — enables the trigram extension and creates GIN indexes on `lower(recipient_name)`, `lower(creator_name)`, `lower(short_code)` to hit the 500ms / 10k-row admin list budget.
- **`migrations/0003_settings.sql`** — creates the key/value `settings` table and seeds `default_activation_window_hours=21` and `maintenance_mode=false`.
- **`migrations/0004_window_trigger.sql`** — enforces the fixed 21-hour window at INSERT and immutable `activate_at` + monotonic `expires_at` at UPDATE. Belts-and-braces against rogue SQL.
- **`migrations/0005_view_count_rpc.sql`** — defines `increment_view_count(_id uuid)` used by the unlock route. Encodes the 30-min dedupe in a single atomic UPDATE.

## Apply order

The Supabase CLI applies files alphabetically. The numbered prefix ensures ordering. Adding a new migration: `supabase/migrations/0006_<short_description>.sql`.

## Rollback policy

There is no auto-rollback. In dev: `npm run db:reset` wipes and replays everything. In prod: write a new forward-only migration. Never edit a migration that has already been applied to prod.

## Storage

The bucket `celebrations` is **not** created by migrations (the Supabase CLI's bucket-creation syntax is unstable across versions). Create it once in Supabase Studio: Storage → New bucket → name `celebrations`, public read enabled. The application references the bucket name via `STORAGE_BUCKET` in `src/lib/constants.ts`.
