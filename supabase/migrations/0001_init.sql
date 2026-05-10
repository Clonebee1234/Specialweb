-- =============================================================================
-- 0001_init.sql
-- Core `celebrations` table with every column, CHECK constraint, and index
-- required by the design. Triggers (0004) enforce the fixed 21-hour window
-- and monotonic expires_at at INSERT/UPDATE time.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.celebrations (
  id uuid primary key default gen_random_uuid(),

  -- Identity
  short_code       varchar(8)  not null unique,
  passcode         varchar(255) not null,          -- scrypt$N$r$p$salt$hash
  passcode_version integer     not null default 1, -- bumped on admin reset

  -- Classification
  type   varchar(20) not null check (type in ('birthday','expression')),
  status varchar(20) not null default 'pending'
         check (status in ('pending','active','inactive','deleted')),
  theme  varchar(50) not null,

  -- Common content
  recipient_name varchar(100) not null,
  creator_name   varchar(100) not null,
  relationship   varchar(50)  not null,
  song_url       text,
  photos         jsonb not null default '[]'::jsonb,

  -- Birthday-only
  hero_text      text,
  reasons        jsonb default '[]'::jsonb,
  quiz_questions jsonb default '[]'::jsonb,
  final_message  text,

  -- Expression-only
  confession_message text,
  things_i_notice    jsonb default '[]'::jsonb,
  closing_line       text,

  -- Expression reply
  expression_reply            text,
  expression_reply_downloaded boolean not null default false,

  -- Timing (always UTC)
  activate_at timestamptz not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),

  -- Admin tracking
  approved_at       timestamptz,
  approved_by       varchar(100),
  admin_notes       text,
  times_reactivated integer not null default 0,
  last_viewed_at    timestamptz,
  view_count        integer not null default 0,

  -- Invariants from Requirement 27
  constraint short_code_format
    check (short_code ~ '^[A-Za-z0-9]{6,8}$'),
  constraint temporal_order
    check (expires_at > activate_at),
  constraint approval_before_active
    check (status <> 'active' or approved_at is not null),
  constraint birthday_shape
    check (
      type <> 'birthday' or (
        jsonb_array_length(reasons)        between 5 and 10
        and jsonb_array_length(photos)     between 3 and 7
        and jsonb_array_length(quiz_questions) = 5
        and hero_text is not null
        and final_message is not null
      )
    ),
  constraint expression_shape
    check (
      type <> 'expression' or (
        jsonb_array_length(things_i_notice) between 3 and 5
        and jsonb_array_length(photos)      between 2 and 4
        and confession_message is not null
        and char_length(confession_message) between 1 and 1500
        and closing_line is not null
      )
    )
);

create index if not exists idx_celeb_status      on public.celebrations (status);
create index if not exists idx_celeb_expires_at  on public.celebrations (expires_at);
create index if not exists idx_celeb_activate_at on public.celebrations (activate_at);
-- Composite covering the admin list's primary filter+sort path.
create index if not exists idx_celeb_status_type_activate_at
  on public.celebrations (status, type, activate_at desc);
