-- =============================================================================
-- 0004_window_trigger.sql
-- Enforces three invariants on the `celebrations` table at the DB layer:
--   1. On INSERT, expires_at = activate_at + 21 hours exactly (fixed window).
--   2. activate_at is immutable after INSERT (extensions only move expires_at).
--   3. expires_at may only move forward in time (monotonic extensions).
-- This belts-and-braces the application-level checks so a rogue client or
-- stray SQL update can never break the lifecycle contract.
-- =============================================================================

create or replace function public.trg_celebrations_window()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.expires_at <> new.activate_at + interval '21 hours' then
      raise exception 'fixed_window_21h_violation: expires_at must equal activate_at + 21h on INSERT'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.activate_at <> old.activate_at then
      raise exception 'activate_at_is_immutable: activate_at may not change after INSERT'
        using errcode = '23514';
    end if;
    if new.expires_at < old.expires_at then
      raise exception 'expires_at_may_only_move_forward: expires_at must not decrease'
        using errcode = '23514';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists celebrations_window on public.celebrations;

create trigger celebrations_window
  before insert or update on public.celebrations
  for each row execute function public.trg_celebrations_window();
