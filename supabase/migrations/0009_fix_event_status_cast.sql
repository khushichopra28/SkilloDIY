create or replace function public.save_admin_event(
  p_event_id uuid,
  p_event jsonb,
  p_lead_handler_id uuid,
  p_member_handler_ids uuid[],
  p_lead_details jsonb
) returns public.events
language plpgsql security definer set search_path=public,auth as $$
declare
  v_actor public.profiles;
  v_city public.cities;
  v_event public.events;
  v_ids uuid[];
  v_member_ids uuid[] := coalesce(p_member_handler_ids,'{}'::uuid[]);
  v_org uuid;
begin
  select * into v_actor from public.profiles where id=auth.uid() and status='active' and role in ('super_admin','city_admin');
  if v_actor.id is null then raise exception 'admin_required'; end if;
  if p_lead_handler_id is null then raise exception 'event_lead_required'; end if;
  if p_lead_handler_id=any(v_member_ids) or cardinality(v_member_ids)<>(select count(distinct x) from unnest(v_member_ids) x) then
    raise exception 'duplicate_event_handler';
  end if;
  v_ids:=array_prepend(p_lead_handler_id,v_member_ids);
  if cardinality(v_ids)>50 then raise exception 'event_team_limit_exceeded'; end if;
  if coalesce(trim(p_event->>'name'),'')='' or coalesce(trim(p_event->>'activity_name'),'')='' then raise exception 'event_details_required'; end if;
  if (p_event->>'city_id') is null then raise exception 'event_city_required'; end if;
  select * into v_city from public.cities where id=(p_event->>'city_id')::uuid and active and organization_id=v_actor.organization_id;
  if v_city.id is null or not public.can_manage_city(v_city.id) then raise exception 'event_city_not_authorized'; end if;
  if exists (
    select 1 from unnest(v_ids) h(id) left join public.profiles p on p.id=h.id
    where p.id is null or p.organization_id<>v_actor.organization_id or p.role<>'handler' or p.status<>'active' or p.verification_status<>'VERIFIED'
  ) then raise exception 'active_verified_handler_required'; end if;

  if p_event_id is not null then
    select organization_id into v_org from public.events where id=p_event_id for update;
    if v_org is null or v_org<>v_actor.organization_id or not public.can_manage_event(p_event_id) then raise exception 'event_not_authorized'; end if;
  end if;
  if p_event_id is null then
    insert into public.events(id,organization_id,created_by,event_code,name,type,description,client_name,event_date,venue,address,city,city_id,activity_id,activity_name,expected_arrival_time,expected_participants,age_group,theme,status,required_handlers)
    values((p_event->>'id')::uuid,v_actor.organization_id,auth.uid(),nullif(p_event->>'event_code',''),trim(p_event->>'name'),p_event->>'type',nullif(trim(p_event->>'description'),''),nullif(trim(p_event->>'client_name'),''),(p_event->>'event_date')::date,trim(p_event->>'venue'),trim(p_event->>'address'),v_city.name,v_city.id,nullif(p_event->>'activity_id','')::uuid,trim(p_event->>'activity_name'),nullif(p_event->>'expected_arrival_time','')::time,(p_event->>'expected_participants')::integer,nullif(trim(p_event->>'age_group'),''),nullif(trim(p_event->>'theme'),''),coalesce((p_event->>'status')::public.event_status,'draft'::public.event_status),cardinality(v_ids)) returning * into v_event;
  else
    update public.events set name=trim(p_event->>'name'),type=p_event->>'type',description=nullif(trim(p_event->>'description'),''),client_name=nullif(trim(p_event->>'client_name'),''),event_date=(p_event->>'event_date')::date,venue=trim(p_event->>'venue'),address=trim(p_event->>'address'),city=v_city.name,city_id=v_city.id,activity_id=nullif(p_event->>'activity_id','')::uuid,activity_name=trim(p_event->>'activity_name'),expected_arrival_time=nullif(p_event->>'expected_arrival_time','')::time,expected_participants=(p_event->>'expected_participants')::integer,age_group=nullif(trim(p_event->>'age_group'),''),theme=nullif(trim(p_event->>'theme'),''),status=coalesce((p_event->>'status')::public.event_status,'draft'::public.event_status),required_handlers=cardinality(v_ids),updated_at=clock_timestamp()
    where id=p_event_id returning * into v_event;
  end if;

  delete from public.event_assignments where event_id=v_event.id and not(handler_id=any(v_ids));
  update public.event_assignments set role='member', responsibility='Member'
    where event_id=v_event.id and role='lead' and handler_id<>p_lead_handler_id;
  insert into public.event_assignments(event_id,handler_id,role,responsibility,status)
  select v_event.id,h.id,case when h.id=p_lead_handler_id then 'lead' else 'member' end,
    case when h.id=p_lead_handler_id then 'Lead' else 'Member' end,'assigned'
  from unnest(v_ids) h(id)
  on conflict(event_id,handler_id) do update set role=excluded.role,responsibility=excluded.responsibility;

  if p_lead_details is not null then
    if coalesce(p_lead_details->>'payment_method','') not in ('','GPay','Cash') then raise exception 'payment_method_invalid'; end if;
    if p_lead_details->>'payment_method'='GPay' and coalesce(trim(p_lead_details->>'payment_screenshot_path'),'')='' then raise exception 'gpay_screenshot_required'; end if;
    if p_lead_details->>'payment_method'='Cash' and nullif(trim(p_lead_details->>'payment_screenshot_path'),'') is not null then raise exception 'cash_screenshot_not_allowed'; end if;
    if coalesce(p_lead_details->>'payment_method','')='' and nullif(trim(p_lead_details->>'payment_screenshot_path'),'') is not null then raise exception 'payment_screenshot_requires_gpay'; end if;
    if nullif(trim(p_lead_details->>'event_photo_path'),'') is not null and (p_lead_details->>'event_photo_path' not like '%/'||v_event.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='event-lead-files' and name=p_lead_details->>'event_photo_path')) then raise exception 'event_photo_path_invalid'; end if;
    if nullif(trim(p_lead_details->>'payment_screenshot_path'),'') is not null and (p_lead_details->>'payment_screenshot_path' not like '%/'||v_event.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='event-lead-files' and name=p_lead_details->>'payment_screenshot_path')) then raise exception 'payment_screenshot_path_invalid'; end if;
    insert into public.event_lead_details(event_id,event_photo_path,amount_paid,payment_method,payment_screenshot_path,updated_by,updated_at)
    values(v_event.id,nullif(trim(p_lead_details->>'event_photo_path'),''),nullif(p_lead_details->>'amount_paid','')::numeric,nullif(p_lead_details->>'payment_method',''),nullif(trim(p_lead_details->>'payment_screenshot_path'),''),auth.uid(),clock_timestamp())
    on conflict(event_id) do update set event_photo_path=excluded.event_photo_path,amount_paid=excluded.amount_paid,payment_method=excluded.payment_method,payment_screenshot_path=excluded.payment_screenshot_path,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  end if;
  return v_event;
end $$;
revoke all on function public.save_admin_event(uuid,jsonb,uuid,uuid[],jsonb) from public,anon;
grant execute on function public.save_admin_event(uuid,jsonb,uuid,uuid[],jsonb) to authenticated;

create or replace function public.save_admin_event_with_venue(
  p_event_id uuid,
  p_event jsonb,
  p_lead_handler_id uuid,
  p_member_handler_ids uuid[],
  p_lead_details jsonb,
  p_venue jsonb
) returns public.events
language plpgsql security definer set search_path=public,auth as $$
declare
  v_event public.events;
  v_city public.cities;
  v_venue public.venues;
  v_venue_id uuid;
  v_name text := nullif(trim(p_venue->>'name'),'');
  v_address text := nullif(trim(p_venue->>'address'),'');
  v_place_id text := nullif(trim(p_venue->>'google_place_id'),'');
  v_lat numeric(9,6) := nullif(p_venue->>'latitude','')::numeric;
  v_lng numeric(9,6) := nullif(p_venue->>'longitude','')::numeric;
begin
  if v_name is null or v_address is null then raise exception 'event_venue_required'; end if;
  if v_lat is not null and v_lat not between -90 and 90 then raise exception 'venue_coordinates_invalid'; end if;
  if v_lng is not null and v_lng not between -180 and 180 then raise exception 'venue_coordinates_invalid'; end if;

  v_event := public.save_admin_event(p_event_id,p_event,p_lead_handler_id,p_member_handler_ids,p_lead_details);
  select * into v_city from public.cities
    where id=v_event.city_id and organization_id=v_event.organization_id and active;
  if v_city.id is null or not public.can_manage_city(v_city.id) then raise exception 'event_city_not_authorized'; end if;

  if nullif(p_venue->>'venue_id','') is not null then
    select * into v_venue from public.venues where id=(p_venue->>'venue_id')::uuid for update;
    if v_venue.id is null or v_venue.organization_id<>v_event.organization_id or v_venue.city_id<>v_city.id then
      raise exception 'venue_city_mismatch';
    end if;
    if v_place_id is not null and v_venue.google_place_id is distinct from v_place_id then
      raise exception 'venue_place_id_mismatch';
    end if;
    update public.venues set name=v_name,address=v_address,google_place_id=coalesce(v_place_id,google_place_id),
      latitude=v_lat,longitude=v_lng where id=v_venue.id returning * into v_venue;
  elsif v_place_id is not null then
    select * into v_venue from public.venues
      where organization_id=v_event.organization_id and google_place_id=v_place_id for update;
    if v_venue.id is not null then
      if v_venue.city_id<>v_city.id then raise exception 'venue_city_mismatch'; end if;
      update public.venues set name=v_name,address=v_address,latitude=v_lat,longitude=v_lng
        where id=v_venue.id returning * into v_venue;
    else
      insert into public.venues(organization_id,city_id,name,address,google_place_id,latitude,longitude)
        values(v_event.organization_id,v_city.id,v_name,v_address,v_place_id,v_lat,v_lng) returning * into v_venue;
    end if;
  else
    insert into public.venues(organization_id,city_id,name,address,latitude,longitude)
      values(v_event.organization_id,v_city.id,v_name,v_address,v_lat,v_lng) returning * into v_venue;
  end if;
  v_venue_id := v_venue.id;

  update public.events set venue_id=v_venue_id,venue=v_venue.name,address=v_venue.address,
    latitude=v_venue.latitude,longitude=v_venue.longitude,city=v_city.name,city_id=v_city.id,
    updated_at=clock_timestamp()
    where id=v_event.id returning * into v_event;
  return v_event;
end $$;

revoke all on function public.save_admin_event_with_venue(uuid,jsonb,uuid,uuid[],jsonb,jsonb) from public,anon;
grant execute on function public.save_admin_event_with_venue(uuid,jsonb,uuid,uuid[],jsonb,jsonb) to authenticated;
