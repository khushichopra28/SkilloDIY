-- 0010_handler_event_read_access.sql
-- Fixes: event_read compared a.event_id = a.id (always false), so assigned handlers
-- could not see their events. Also lets assigned handlers read their event's venue and city.

create or replace function public.is_assigned_to_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_assignments a
    where a.event_id = p_event_id
      and a.handler_id = auth.uid()
      and coalesce(a.status::text, '') not in ('removed', 'cancelled', 'declined')
  );
$$;

create or replace function public.can_view_venue_as_assignee(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.event_assignments a on a.event_id = e.id
    where e.venue_id = p_venue_id
      and a.handler_id = auth.uid()
      and coalesce(a.status::text, '') not in ('removed', 'cancelled', 'declined')
  );
$$;

create or replace function public.can_view_city_as_assignee(p_city_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.event_assignments a on a.event_id = e.id
    where e.city_id = p_city_id
      and a.handler_id = auth.uid()
      and coalesce(a.status::text, '') not in ('removed', 'cancelled', 'declined')
  );
$$;

revoke all on function public.is_assigned_to_event(uuid) from public;
revoke all on function public.can_view_venue_as_assignee(uuid) from public;
revoke all on function public.can_view_city_as_assignee(uuid) from public;
grant execute on function public.is_assigned_to_event(uuid) to authenticated;
grant execute on function public.can_view_venue_as_assignee(uuid) to authenticated;
grant execute on function public.can_view_city_as_assignee(uuid) to authenticated;

-- Repair the events read rule (same logic as before, with the broken comparison fixed)
drop policy if exists event_read on public.events;
create policy event_read on public.events
  for select
  using (
    organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid())
    and (
      can_manage_city(city_id)
      or (city_id is null and is_super_admin())
      or public.is_assigned_to_event(id)
    )
  );

-- Let assigned handlers read the venue and city of their own events (read only)
drop policy if exists venue_assignee_read on public.venues;
create policy venue_assignee_read on public.venues
  for select
  using (public.can_view_venue_as_assignee(id));

drop policy if exists city_assignee_read on public.cities;
create policy city_assignee_read on public.cities
  for select
  using (public.can_view_city_as_assignee(id));