-- =============================================================================
-- 0005_view_count_rpc.sql
-- Atomic view-count increment function used by the unlock endpoint.
-- The 30-minute dedupe window (Req 20.2) is encoded in the WHERE clause.
-- Returns the final view_count so callers can log/meter without a second read.
-- =============================================================================

create or replace function public.increment_view_count(_id uuid)
returns integer
language sql
volatile
as $$
  update public.celebrations
     set view_count = view_count + 1,
         last_viewed_at = now()
   where id = _id
     and (last_viewed_at is null or last_viewed_at < now() - interval '30 minutes')
  returning view_count;
$$;

-- Permit anon/authenticated to execute; tightened by RLS if/when added.
grant execute on function public.increment_view_count(uuid) to service_role;
