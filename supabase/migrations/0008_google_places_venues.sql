-- Extend existing venues with Google Places identity and map coordinates.
alter table public.venues
  add column google_place_id text,
  add column latitude numeric(9,6),
  add column longitude numeric(9,6),
  add constraint venues_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint venues_longitude_range check (longitude is null or longitude between -180 and 180);

create unique index venues_organization_google_place_id_key
  on public.venues(organization_id, google_place_id)
  where google_place_id is not null;

-- Reuse the established admin event transaction, then save the venue link and both
-- coordinate copies atomically in this RPC call.
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

  -- The established RPC performs admin, city, assignment and lead-detail validation.
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
