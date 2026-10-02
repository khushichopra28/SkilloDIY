-- Self-service handler onboarding. Existing active handlers keep their current IDs and access.
-- New public applicants do not receive a profiles row or handler privileges until approval.

alter table public.profiles
  add column verification_status text not null default 'VERIFIED'
    check (verification_status in ('PENDING','VERIFIED','REJECTED','RESUBMISSION_REQUIRED')),
  add column can_verify_handlers boolean not null default false;
alter table public.audit_log add column actor_auth_id uuid references auth.users(id) on delete set null;

create table public.handler_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  legal_name text,
  preferred_name text,
  phone text,
  home_city_id uuid references public.cities(id),
  profile_photo_path text,
  emergency_contact_name text,
  emergency_contact_phone text,
  skills_experience text,
  availability text,
  preferred_event_locations uuid[] not null default '{}',
  status text not null default 'profile_incomplete'
    check (status in ('profile_incomplete','verification_pending','resubmission_required','rejected','approved')),
  profile_completion smallint not null default 0 check (profile_completion between 0 and 100),
  consent_version text,
  consented_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index handler_applications_queue_idx on public.handler_applications(organization_id,status,submitted_at desc);
create index handler_applications_city_idx on public.handler_applications(home_city_id,status);

create table public.handler_verifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.handler_applications(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('Aadhaar card','Passport','Driving licence','Voter ID','Other government photo ID')),
  document_path text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING','VERIFIED','REJECTED','RESUBMISSION_REQUIRED')),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.handler_applications enable row level security;
alter table public.handler_verifications enable row level security;
grant select on public.handler_applications, public.handler_verifications to authenticated;

create or replace function public.can_review_handler_application(p_application_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.handler_applications a
    where a.id=p_application_id and (
      (public.is_super_admin() and a.organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()))
      or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='city_admin' and p.status='active'
        and p.can_verify_handlers and p.organization_id=a.organization_id and public.can_manage_city(a.home_city_id))
    )
  )
$$;
create or replace function public.can_review_handler_applications()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_super_admin() or exists(select 1 from public.profiles p where p.id=auth.uid()
    and p.role='city_admin' and p.status='active' and p.can_verify_handlers)
$$;
revoke all on function public.can_review_handler_application(uuid) from public,anon;
grant execute on function public.can_review_handler_application(uuid) to authenticated;
revoke all on function public.can_review_handler_applications() from public,anon;
grant execute on function public.can_review_handler_applications() to authenticated;

create policy handler_application_owner_read on public.handler_applications
  for select to authenticated using (user_id=auth.uid());
create policy handler_application_reviewer_read on public.handler_applications
  for select to authenticated using (public.can_review_handler_application(id));
create policy handler_verification_owner_read on public.handler_verifications
  for select to authenticated using (user_id=auth.uid());
create policy handler_verification_reviewer_read on public.handler_verifications
  for select to authenticated using (public.can_review_handler_application(application_id));

-- Private government ID storage is separate from ordinary event documents and receipts.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('identity-documents','identity-documents',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

create or replace function public.identity_document_owner(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.handler_verifications v where v.document_path=p_path and v.user_id=auth.uid())
$$;
create or replace function public.identity_document_reviewer(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.handler_verifications v where v.document_path=p_path and public.can_review_handler_application(v.application_id))
$$;
create or replace function public.handler_application_photo_reviewer(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.handler_applications a where a.profile_photo_path=p_path and public.can_review_handler_application(a.id))
$$;
revoke all on function public.identity_document_owner(text) from public,anon;
grant execute on function public.identity_document_owner(text) to authenticated;
revoke all on function public.identity_document_reviewer(text) from public,anon;
grant execute on function public.identity_document_reviewer(text) to authenticated;
revoke all on function public.handler_application_photo_reviewer(text) from public,anon;
grant execute on function public.handler_application_photo_reviewer(text) to authenticated;
create policy handler_identity_upload on storage.objects for insert to authenticated
  with check(bucket_id='identity-documents' and public.identity_document_owner(name));
create policy handler_identity_read_own on storage.objects for select to authenticated
  using(bucket_id='identity-documents' and public.identity_document_owner(name));
create policy handler_identity_read_reviewer on storage.objects for select to authenticated
  using(bucket_id='identity-documents' and public.identity_document_reviewer(name));
create policy handler_application_photo_review on storage.objects for select to authenticated
  using(bucket_id='documents' and public.handler_application_photo_reviewer(name));

create or replace function public.ensure_handler_application()
returns table(application_id uuid,onboarding_status text,verification_status text,profile_completion integer)
language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_org uuid; v_name text; v_email text; v_count integer; v_row public.handler_applications;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if exists(select 1 from public.profiles p where p.id=v_user) then raise exception 'handler_profile_already_exists'; end if;
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then raise exception 'onboarding_organization_not_configured'; end if;
  select count(*) into v_count from public.organizations;
  if v_count<>1 then raise exception 'onboarding_organization_ambiguous'; end if;
  select coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name','')),coalesce(u.email,'')
    into v_name,v_email from auth.users u where u.id=v_user;
  insert into public.handler_applications(user_id,organization_id,email,legal_name)
    values(v_user,v_org,v_email,v_name) on conflict(user_id) do nothing;
  select * into v_row from public.handler_applications a where a.user_id=v_user;
  return query select v_row.id,v_row.status,
    coalesce((select v.status from public.handler_verifications v where v.application_id=v_row.id),'PENDING'),
    v_row.profile_completion::integer;
end $$;
revoke all on function public.ensure_handler_application() from public;
grant execute on function public.ensure_handler_application() to authenticated;

create or replace function public.list_onboarding_cities()
returns table(id uuid,name text,code text)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.code from public.cities c
  where c.active and exists(select 1 from public.handler_applications a where a.user_id=auth.uid() and a.organization_id=c.organization_id and a.status<>'approved')
  order by c.name
$$;
revoke all on function public.list_onboarding_cities() from public;
grant execute on function public.list_onboarding_cities() to authenticated;

create or replace function public.save_handler_application_profile(
  p_legal_name text,p_preferred_name text,p_phone text,p_home_city_id uuid,p_profile_photo_path text,
  p_emergency_contact_name text,p_emergency_contact_phone text,p_skills_experience text,
  p_availability text,p_preferred_event_locations uuid[] default '{}'
) returns public.handler_applications
language plpgsql security definer set search_path=public,storage as $$
declare v_app public.handler_applications; v_completion integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_app from public.handler_applications where user_id=auth.uid() for update;
  if v_app.id is null then raise exception 'handler_application_not_found'; end if;
  if v_app.status not in ('profile_incomplete','resubmission_required','rejected') then raise exception 'application_profile_locked'; end if;
  if length(p_legal_name)>120 or length(p_preferred_name)>80 or length(p_phone)>30 or length(p_emergency_contact_name)>120 or length(p_emergency_contact_phone)>30 or length(p_skills_experience)>2000 or length(p_availability)>1000 then raise exception 'profile_field_too_long'; end if;
  if nullif(trim(coalesce(p_phone,'')),'') is not null and length(regexp_replace(p_phone,'[^0-9]','','g'))<7 then raise exception 'phone_invalid'; end if;
  if p_home_city_id is not null and not exists(select 1 from public.cities c where c.id=p_home_city_id and c.organization_id=v_app.organization_id and c.active) then raise exception 'home_city_invalid'; end if;
  if p_profile_photo_path is not null and (p_profile_photo_path not like auth.uid()::text||'/onboarding/'||v_app.id::text||'/%'
     or not exists(select 1 from storage.objects o where o.bucket_id='documents' and o.name=p_profile_photo_path)) then raise exception 'profile_photo_invalid'; end if;
  if nullif(trim(coalesce(p_emergency_contact_phone,'')),'') is not null and length(regexp_replace(p_emergency_contact_phone,'[^0-9]','','g'))<7 then raise exception 'emergency_contact_phone_invalid'; end if;
  if exists(select 1 from unnest(coalesce(p_preferred_event_locations,'{}'::uuid[])) city_id
    where not exists(select 1 from public.cities c where c.id=city_id and c.organization_id=v_app.organization_id and c.active)) then raise exception 'preferred_city_invalid'; end if;
  v_completion:=(case when length(trim(coalesce(p_legal_name,'')))>=2 then 20 else 0 end)
    +(case when length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'))>=7 then 15 else 0 end)
    +(case when p_home_city_id is not null then 15 else 0 end)
    +(case when p_profile_photo_path is not null then 15 else 0 end)
    +(case when length(trim(coalesce(p_emergency_contact_name,'')))>=2 and length(regexp_replace(coalesce(p_emergency_contact_phone,''),'[^0-9]','','g'))>=7 then 15 else 0 end)
    +(case when length(trim(coalesce(p_skills_experience,'')))>=3 then 10 else 0 end)
    +(case when length(trim(coalesce(p_availability,'')))>=3 then 10 else 0 end);
  update public.handler_applications set legal_name=nullif(trim(coalesce(p_legal_name,'')),''),preferred_name=nullif(trim(coalesce(p_preferred_name,'')),''),
    phone=nullif(trim(coalesce(p_phone,'')),''),home_city_id=p_home_city_id,profile_photo_path=p_profile_photo_path,
    emergency_contact_name=nullif(trim(coalesce(p_emergency_contact_name,'')),''),emergency_contact_phone=nullif(trim(coalesce(p_emergency_contact_phone,'')),''),
    skills_experience=nullif(trim(coalesce(p_skills_experience,'')),''),availability=nullif(trim(coalesce(p_availability,'')),''),
    preferred_event_locations=coalesce(p_preferred_event_locations,'{}'::uuid[]),profile_completion=v_completion,
    status=case when status in ('rejected','resubmission_required') then 'profile_incomplete' else status end,updated_at=clock_timestamp()
    where id=v_app.id returning * into v_app;
  return v_app;
end $$;
revoke all on function public.save_handler_application_profile(text,text,text,uuid,text,text,text,text,text,uuid[]) from public;
grant execute on function public.save_handler_application_profile(text,text,text,uuid,text,text,text,text,text,uuid[]) to authenticated;

create or replace function public.save_handler_identity_document(p_document_type text,p_document_path text)
returns public.handler_verifications language plpgsql security definer set search_path=public as $$
declare v_app public.handler_applications; v_row public.handler_verifications;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_app from public.handler_applications where user_id=auth.uid() for update;
  if v_app.id is null then raise exception 'handler_application_not_found'; end if;
  if v_app.status not in ('profile_incomplete','resubmission_required','rejected') then raise exception 'application_identity_locked'; end if;
  if p_document_type is null or p_document_type not in ('Aadhaar card','Passport','Driving licence','Voter ID','Other government photo ID') then raise exception 'identity_document_type_invalid'; end if;
  if p_document_path not like auth.uid()::text||'/'||v_app.id::text||'/identity/%' then raise exception 'identity_document_path_invalid'; end if;
  insert into public.handler_verifications(application_id,user_id,document_type,document_path,status)
    values(v_app.id,auth.uid(),p_document_type,p_document_path,'PENDING')
  on conflict(application_id) do update set document_type=excluded.document_type,document_path=excluded.document_path,
    status='PENDING',submitted_at=null,reviewed_by=null,reviewed_at=null,review_note=null,updated_at=clock_timestamp()
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.save_handler_identity_document(text,text) from public;
grant execute on function public.save_handler_identity_document(text,text) to authenticated;

create or replace function public.submit_handler_application(p_privacy_consent boolean,p_accuracy_declaration boolean)
returns public.handler_applications language plpgsql security definer set search_path=public,storage as $$
declare v_app public.handler_applications; v_verification public.handler_verifications;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_app from public.handler_applications where user_id=auth.uid() for update;
  if v_app.id is null then raise exception 'handler_application_not_found'; end if;
  if v_app.status not in ('profile_incomplete','resubmission_required','rejected') then raise exception 'application_already_submitted'; end if;
  if v_app.profile_completion<>100 or v_app.home_city_id is null then raise exception 'profile_incomplete'; end if;
  select * into v_verification from public.handler_verifications where application_id=v_app.id for update;
  if v_verification.id is null or not exists(select 1 from storage.objects o where o.bucket_id='identity-documents' and o.name=v_verification.document_path) then raise exception 'identity_document_required'; end if;
  if p_privacy_consent is not true or p_accuracy_declaration is not true then raise exception 'required_consent_missing'; end if;
  update public.handler_verifications set status='PENDING',submitted_at=clock_timestamp(),reviewed_by=null,reviewed_at=null,review_note=null,updated_at=clock_timestamp() where id=v_verification.id;
  update public.handler_applications set status='verification_pending',consent_version='handler-onboarding-v1',consented_at=clock_timestamp(),submitted_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=v_app.id returning * into v_app;
  insert into public.audit_log(organization_id,city_id,actor_id,actor_auth_id,action,target_type,target_id,details)
    values(v_app.organization_id,v_app.home_city_id,null,auth.uid(),'handler_application_submitted','handler_application',v_app.id::text,jsonb_build_object('status','verification_pending'));
  return v_app;
end $$;
revoke all on function public.submit_handler_application(boolean,boolean) from public;
grant execute on function public.submit_handler_application(boolean,boolean) to authenticated;

-- New IDs are global and city-independent. Existing permanent IDs are never rewritten.
create table public.handler_id_sequence(id boolean primary key default true check(id),last_value bigint not null check(last_value>=0));
insert into public.handler_id_sequence(id,last_value)
  select true,coalesce(max(substring(handler_id from '^SKL-([0-9]+)$')::bigint),0)
  from public.profiles where handler_id ~ '^SKL-[0-9]+$';
alter table public.handler_id_sequence enable row level security;
revoke all on public.handler_id_sequence from anon,authenticated;
create or replace function public.next_handler_id()
returns text language plpgsql security definer set search_path=public as $$
declare v_next bigint;
begin
  update public.handler_id_sequence set last_value=last_value+1 where id=true returning last_value into v_next;
  return 'SKL-'||lpad(v_next::text,greatest(5,length(v_next::text)),'0');
end $$;
revoke all on function public.next_handler_id() from public,anon,authenticated;
create or replace function public.assign_profile_handler_id()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role='handler' then
    if new.handler_id is not null then raise exception 'handler_id_server_generated'; end if;
    if new.home_city_id is null then raise exception 'handler_city_required'; end if;
    if not exists(select 1 from public.cities c where c.id=new.home_city_id and c.organization_id=new.organization_id and c.active) then raise exception 'handler_city_invalid'; end if;
    new.handler_id:=public.next_handler_id();
  end if;
  return new;
end $$;

-- New assignments require an active verified profile; existing assignments remain unchanged.
create or replace function public.guard_verified_handler_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles p join public.events e on e.id=new.event_id
    where p.id=new.handler_id and p.role='handler' and p.status='active' and p.verification_status='VERIFIED' and p.organization_id=e.organization_id) then
    raise exception 'active_verified_handler_required';
  end if;
  return new;
end $$;
create trigger verified_handler_assignment_guard before insert or update of handler_id,event_id on public.event_assignments
  for each row execute function public.guard_verified_handler_assignment();

create or replace function public.can_access_event(eid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.can_manage_event(eid) or exists(select 1 from public.event_assignments a join public.profiles p on p.id=a.handler_id
    where a.event_id=eid and a.handler_id=auth.uid() and p.status='active' and p.verification_status='VERIFIED')
$$;

create or replace function public.record_attendance(p_event_id uuid,p_photo_path text,p_lat numeric default null,p_lng numeric default null,p_kind text default 'check_in')
returns public.attendance language plpgsql security definer set search_path=public as $$
declare v_row public.attendance;v_now timestamptz:=clock_timestamp();v_expected timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='handler' and status='active' and verification_status='VERIFIED') then raise exception 'active_verified_handler_required';end if;
  if not exists(select 1 from public.event_assignments where event_id=p_event_id and handler_id=auth.uid() and status in ('assigned','acknowledged')) then raise exception 'event_assignment_required';end if;
  if p_kind not in ('check_in','check_out') or p_photo_path not like auth.uid()::text||'/'||p_event_id::text||'/%' then raise exception 'invalid_submission';end if;
  if not exists(select 1 from storage.objects where bucket_id='attendance' and name=p_photo_path) then raise exception 'attendance_photo_required';end if;
  if (p_lat is not null and p_lat not between -90 and 90) or (p_lng is not null and p_lng not between -180 and 180) then raise exception 'invalid_location';end if;
  select (event_date+coalesce(expected_arrival_time,start_time)) at time zone 'Asia/Kolkata' into v_expected from public.events where id=p_event_id and status='active';
  if v_expected is null then raise exception 'event_not_active';end if;
  insert into public.attendance(event_id,handler_id) values(p_event_id,auth.uid()) on conflict(event_id,handler_id) do nothing;
  if p_kind='check_in' then
    update public.attendance set check_in_at=v_now,check_in_photo_path=p_photo_path,check_in_lat=p_lat,check_in_lng=p_lng,
      arrival_status=case when v_now<v_expected-interval '15 minutes' then 'early' when v_now<=v_expected+interval '10 minutes' then 'on_time' else 'late' end
      where event_id=p_event_id and handler_id=auth.uid() and check_in_at is null returning * into v_row;
  else
    update public.attendance set check_out_at=v_now,check_out_photo_path=p_photo_path,check_out_lat=p_lat,check_out_lng=p_lng
      where event_id=p_event_id and handler_id=auth.uid() and check_in_at is not null and check_out_at is null returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'attendance_state_invalid';end if;
  insert into public.event_timeline(organization_id,event_id,actor_id,action,details)
    select organization_id,p_event_id,auth.uid(),p_kind,jsonb_build_object('attendance_id',v_row.id) from public.events where id=p_event_id;
  return v_row;
end $$;
revoke all on function public.record_attendance(uuid,text,numeric,numeric,text) from public;
grant execute on function public.record_attendance(uuid,text,numeric,numeric,text) to authenticated;

create or replace function public.submit_expense(p_event_id uuid,p_category text,p_amount numeric,p_expense_date date,p_description text,p_receipt_path text)
returns public.expenses language plpgsql security definer set search_path=public as $$
declare v_expense public.expenses;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='handler' and status='active' and verification_status='VERIFIED') then raise exception 'active_verified_handler_required';end if;
  if not exists(select 1 from public.event_assignments where event_id=p_event_id and handler_id=auth.uid() and status in ('assigned','acknowledged')) then raise exception 'event_assignment_required';end if;
  if p_category not in ('Cab/Travel','Food','Printing','Materials','Local Transport','Other') or p_amount<=0 or p_amount>1000000 or length(trim(p_description))<3 then raise exception 'expense_details_invalid';end if;
  if p_receipt_path not like auth.uid()::text||'/'||p_event_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='receipts' and name=p_receipt_path) then raise exception 'receipt_capture_required';end if;
  insert into public.expenses(event_id,handler_id,category,amount,expense_date,description,receipt_path,status)
    values(p_event_id,auth.uid(),p_category,p_amount,p_expense_date,trim(p_description),p_receipt_path,'submitted') returning * into v_expense;
  return v_expense;
end $$;
revoke all on function public.submit_expense(uuid,text,numeric,date,text,text) from public;
grant execute on function public.submit_expense(uuid,text,numeric,date,text,text) to authenticated;

create or replace function public.review_handler_application(p_application_id uuid,p_decision text,p_note text default null)
returns public.handler_applications language plpgsql security definer set search_path=public,auth as $$
declare v_app public.handler_applications;v_verification public.handler_verifications;v_user auth.users;v_handler_id text;v_status text;v_action text;
begin
  if auth.uid() is null or not public.can_review_handler_application(p_application_id) then raise exception 'verification_review_not_authorized';end if;
  if p_decision is null or p_decision not in ('approve','reject','request_resubmission') then raise exception 'verification_decision_invalid';end if;
  if p_decision<>'approve' and length(trim(coalesce(p_note,'')))<3 then raise exception 'review_note_required';end if;
  select * into v_app from public.handler_applications where id=p_application_id for update;
  if v_app.status<>'verification_pending' then raise exception 'application_not_pending';end if;
  select * into v_verification from public.handler_verifications where application_id=v_app.id for update;
  if v_verification.id is null or v_verification.status<>'PENDING' then raise exception 'identity_verification_not_pending';end if;
  if p_decision='approve' then
    v_status:='VERIFIED';v_action:='handler_application_approved';
    select * into v_user from auth.users where id=v_app.user_id;
    update public.handler_applications set status='approved',updated_at=clock_timestamp() where id=v_app.id returning * into v_app;
    update public.handler_verifications set status=v_status,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=null,updated_at=clock_timestamp() where id=v_verification.id;
    insert into public.profiles(id,organization_id,role,full_name,email,phone,job_title,status,home_city_id,photo_path,emergency_contact,verification_status)
      values(v_app.user_id,v_app.organization_id,'handler',v_app.legal_name,coalesce(v_user.email,''),v_app.phone,'Event Handler','active',v_app.home_city_id,v_app.profile_photo_path,
        jsonb_build_object('name',v_app.emergency_contact_name,'phone',v_app.emergency_contact_phone),'VERIFIED');
    select handler_id into v_handler_id from public.profiles where id=v_app.user_id;
    insert into public.notifications(organization_id,recipient_id,title,body,kind,href)
      values(v_app.organization_id,v_app.user_id,'Your handler profile is verified','Your EventOps handler access is active. Your permanent Handler ID is '||v_handler_id||'.','verification_update','/handler/id-card');
  else
    v_status:=case when p_decision='reject' then 'REJECTED' else 'RESUBMISSION_REQUIRED' end;
    v_action:=case when p_decision='reject' then 'handler_application_rejected' else 'handler_application_resubmission_requested' end;
    update public.handler_applications set status=case when p_decision='reject' then 'rejected' else 'resubmission_required' end,updated_at=clock_timestamp() where id=v_app.id returning * into v_app;
    update public.handler_verifications set status=v_status,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note),updated_at=clock_timestamp() where id=v_verification.id;
  end if;
  insert into public.audit_log(organization_id,city_id,actor_id,actor_auth_id,action,target_type,target_id,details)
    values(v_app.organization_id,v_app.home_city_id,auth.uid(),auth.uid(),v_action,'handler_application',v_app.id::text,
      jsonb_strip_nulls(jsonb_build_object('decision',p_decision,'handler_id',v_handler_id,'reviewed_at',clock_timestamp())));
  return v_app;
end $$;
revoke all on function public.review_handler_application(uuid,text,text) from public;
grant execute on function public.review_handler_application(uuid,text,text) to authenticated;

create or replace function public.verify_handler_id(p_token uuid)
returns table(is_active boolean,handler_id text,full_name text,job_title text,organization_name text,valid_until date)
language sql stable security definer set search_path=public as $$
  select (p.role='handler' and p.status='active' and p.verification_status='VERIFIED' and (d.valid_until is null or d.valid_until>=current_date)),
    p.handler_id,p.full_name,p.job_title,o.name,d.valid_until
  from public.digital_ids d join public.profiles p on p.id=d.profile_id join public.organizations o on o.id=p.organization_id
  where d.verification_token=p_token limit 1
$$;
revoke all on function public.verify_handler_id(uuid) from public;
grant execute on function public.verify_handler_id(uuid) to anon,authenticated;
        