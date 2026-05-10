-- =============================================================================
-- 0002_pg_trgm.sql
-- Enables the trigram extension and builds GIN indexes on lower(recipient_name)
-- and lower(creator_name) to support case-insensitive substring search across
-- the admin celebrations list within the 500ms/10k-row performance budget.
-- =============================================================================

create extension if not exists pg_trgm;

create index if not exists idx_celeb_recipient_trgm
  on public.celebrations using gin (lower(recipient_name) gin_trgm_ops);

create index if not exists idx_celeb_creator_trgm
  on public.celebrations using gin (lower(creator_name) gin_trgm_ops);

create index if not exists idx_celeb_short_code_trgm
  on public.celebrations using gin (lower(short_code) gin_trgm_ops);
