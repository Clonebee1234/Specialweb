-- =============================================================================
-- 0003_settings.sql
-- Key/value settings table for admin-tunable knobs. We keep the runtime behavior
-- fixed (every new celebration gets exactly 21 hours) but this table holds the
-- future-facing default the admin can change, plus maintenance mode and an
-- optional hashed admin password.
-- =============================================================================

create table if not exists public.settings (
  key        varchar(64) primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('default_activation_window_hours', '21'::jsonb),
  ('maintenance_mode', 'false'::jsonb)
on conflict (key) do nothing;
