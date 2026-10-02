-- Move event creation to handler arrival planning without removing legacy event times.
-- Existing events retain their historic start_time/end_time values.
alter table public.events
  add column client_name text;

alter table public.events
  alter column start_time drop not null,
  alter column end_time drop not null;

-- Use expected handler arrival for early/on-time/late attendance classification.
-- Existing active events without the new field retain their previous start_time fallback.
create or replace function public.record_attendance(
  p_event_id uuid,
  p_photo_path text,
  p_lat numeric default null,
  p_lng numeric default null,
  p_kind text default 'check_in'
) returns public.attendance
language plpgsql security definer set search_path=public as $$
declare
  v_row public.attendance;
  v_now timestamptz := clock_timestamp();
  v_expected_arrival timestamptz;
begin
  if auth.uid() is null or not exists(
    select 1 from profiles where id=auth.uid() and role='handler' and status='active'
  ) then raise exception 'active_handler_required'; end if;
  if not exists(
    select 1 from event_assignments
    where event_id=p_event_id and handler_id=auth.uid() and status in ('assigned','acknowledged')
  ) then raise exception 'event_assignment_required'; end if;
  if p_kind not in ('check_in','check_out')
    or p_photo_path not like auth.uid()::text||'/'||p_event_id::text||'/%'
  then raise exception 'invalid_submission'; end if;
  if not exists(select 1 from storage.objects where bucket_id='attendance' and name=p_photo_path)
    then raise exception 'attendance_photo_required'; end if;
  if (p_lat is not null and p_lat not between -90 and 90)
    or (p_lng is not null and p_lng not between -180 and 180)
  then raise exception 'invalid_location'; end if;

  select (event_date + coalesce(expected_arrival_time,start_time)) at time zone 'Asia/Kolkata'
    into v_expected_arrival
  from events where id=p_event_id and status='active';
  if v_expected_arrival is null then raise exception 'event_not_active'; end if;

  insert into attendance(event_id,handler_id)
    values(p_event_id,auth.uid()) on conflict(event_id,handler_id) do nothing;
  if p_kind='check_in' then
    update attendance set
      check_in_at=v_now,
      check_in_photo_path=p_photo_path,
      check_in_lat=p_lat,
      check_in_lng=p_lng,
      arrival_status=case
        when v_now < v_expected_arrival-interval '15 minutes' then 'early'
        when v_now <= v_expected_arrival+interval '10 minutes' then 'on_time'
        else 'late'
      end
    where event_id=p_event_id and handler_id=auth.uid() and check_in_at is null
    returning * into v_row;
  else
    update attendance set
      check_out_at=v_now,
      check_out_photo_path=p_photo_path,
      check_out_lat=p_lat,
      check_out_lng=p_lng
    where event_id=p_event_id and handler_id=auth.uid()
      and check_in_at is not null and check_out_at is null
    returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'attendance_state_invalid'; end if;
  insert into event_timeline(organization_id,event_id,actor_id,action,details)
    select organization_id,p_event_id,auth.uid(),p_kind,jsonb_build_object('attendance_id',v_row.id)
    from events where id=p_event_id;
  return v_row;
end $$;

revoke all on function public.record_attendance(uuid,text,numeric,numeric,text) from public;
grant execute on function public.record_attendance(uuid,text,numeric,numeric,text) to authenticated;
