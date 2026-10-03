-- Add explicit event team roles and private event-level lead details.
alter table public.event_assignments
  add column role text not null default 'member' check (role in ('lead','member'));
create unique index event_assignments_one_lead_per_event
  on public.event_assignments(event_id) where role='lead';

alter table public.events add column activity_name text;

create table public.event_lead_details (
  event_id uuid primary key references public.events(id) on delete cascade,
  event_photo_path text,
  amount_paid numeric(12,2) check (amount_paid is null or amount_paid >= 0),
  payment_method text check (payment_method is null or payment_method in ('GPay','Cash')),
  payment_screenshot_path text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (
    (payment_method is null and payment_screenshot_path is null)
    or (payment_method='Cash' and payment_screenshot_path is null)
    or (payment_method='GPay' and payment_screenshot_path is not null)
  )
);
alter table public.event_lead_details enable row level security;
grant select,insert,update on public.event_lead_details to authenticated;
create policy event_lead_details_read on public.event_lead_details for select to authenticated
  using (public.can_manage_event(event_id) or exists (
    select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
    where a.event_id=event_lead_details.event_id and a.handler_id=auth.uid() and a.role='lead'
      and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED'
  ));
create policy event_lead_details_write on public.event_lead_details for all to authenticated
  using (public.can_manage_event(event_id) or exists (
    select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
    where a.event_id=event_lead_details.event_id and a.handler_id=auth.uid() and a.role='lead'
      and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED'
  ))
  with check (public.can_manage_event(event_id) or exists (
    select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
    where a.event_id=event_lead_details.event_id and a.handler_id=auth.uid() and a.role='lead'
      and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED'
  ));
create or replace function public.validate_event_lead_detail_files()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_by:=auth.uid();
  new.updated_at:=clock_timestamp();
  if new.event_photo_path is not null and (new.event_photo_path not like '%/'||new.event_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='event-lead-files' and name=new.event_photo_path)) then raise exception 'event_photo_required'; end if;
  if new.payment_screenshot_path is not null and (new.payment_screenshot_path not like '%/'||new.event_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='event-lead-files' and name=new.payment_screenshot_path)) then raise exception 'payment_screenshot_required'; end if;
  return new;
end $$;
create trigger event_lead_details_files_guard before insert or update on public.event_lead_details
  for each row execute function public.validate_event_lead_detail_files();

-- The bucket keeps event-level material out of the handler-owned attendance/receipt folders.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('event-lead-files','event-lead-files',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy event_lead_files_read on storage.objects for select to authenticated
  using (bucket_id='event-lead-files' and (
    (public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text)
    or exists(select 1 from public.events e where e.id::text=(storage.foldername(name))[2] and public.can_manage_event(e.id))
    or exists(select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
      where a.event_id::text=(storage.foldername(name))[2] and a.handler_id=auth.uid() and a.role='lead'
        and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED')
  ));
create policy event_lead_files_insert on storage.objects for insert to authenticated
  with check (bucket_id='event-lead-files' and (
    (public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text)
    or exists(select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
      where a.event_id::text=(storage.foldername(name))[2] and a.handler_id=auth.uid() and a.role='lead'
        and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED')
  ));
create policy event_lead_files_update on storage.objects for update to authenticated
  using (bucket_id='event-lead-files' and (
    (public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text)
    or exists(select 1 from public.events e where e.id::text=(storage.foldername(name))[2] and public.can_manage_event(e.id))
    or exists(select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
      where a.event_id::text=(storage.foldername(name))[2] and a.handler_id=auth.uid() and a.role='lead'
        and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED')
  ))
  with check (bucket_id='event-lead-files' and (
    (public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text)
    or exists(select 1 from public.events e where e.id::text=(storage.foldername(name))[2] and public.can_manage_event(e.id))
    or exists(select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
      where a.event_id::text=(storage.foldername(name))[2] and a.handler_id=auth.uid() and a.role='lead'
        and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED')
  ));
create policy event_lead_files_delete on storage.objects for delete to authenticated
  using (bucket_id='event-lead-files' and (
    (public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text)
    or exists(select 1 from public.events e where e.id::text=(storage.foldername(name))[2] and public.can_manage_event(e.id))
    or exists(select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
      where a.event_id::text=(storage.foldername(name))[2] and a.handler_id=auth.uid() and a.role='lead'
        and a.status in ('assigned','acknowledged') and p.status='active' and p.verification_status='VERIFIED')
  ));

-- Event and team changes, including removal/revocation and private lead fields, commit together.
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
  v_existing_event uuid;
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
    values((p_event->>'id')::uuid,v_actor.organization_id,auth.uid(),nullif(p_event->>'event_code',''),trim(p_event->>'name'),p_event->>'type',nullif(trim(p_event->>'description'),''),nullif(trim(p_event->>'client_name'),''),(p_event->>'event_date')::date,trim(p_event->>'venue'),trim(p_event->>'address'),v_city.name,v_city.id,nullif(p_event->>'activity_id','')::uuid,trim(p_event->>'activity_name'),nullif(p_event->>'expected_arrival_time','')::time,(p_event->>'expected_participants')::integer,nullif(trim(p_event->>'age_group'),''),nullif(trim(p_event->>'theme'),''),coalesce(p_event->>'status','draft'),cardinality(v_ids)) returning * into v_event;
  else
    update public.events set name=trim(p_event->>'name'),type=p_event->>'type',description=nullif(trim(p_event->>'description'),''),client_name=nullif(trim(p_event->>'client_name'),''),event_date=(p_event->>'event_date')::date,venue=trim(p_event->>'venue'),address=trim(p_event->>'address'),city=v_city.name,city_id=v_city.id,activity_id=nullif(p_event->>'activity_id','')::uuid,activity_name=trim(p_event->>'activity_name'),expected_arrival_time=nullif(p_event->>'expected_arrival_time','')::time,expected_participants=(p_event->>'expected_participants')::integer,age_group=nullif(trim(p_event->>'age_group'),''),theme=nullif(trim(p_event->>'theme'),''),status=coalesce(p_event->>'status','draft'),required_handlers=cardinality(v_ids),updated_at=clock_timestamp()
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
