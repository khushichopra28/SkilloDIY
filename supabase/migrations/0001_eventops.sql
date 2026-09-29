create extension if not exists pgcrypto;
create type public.member_role as enum ('admin','handler');
create type public.event_status as enum ('draft','upcoming','active','completed','cancelled','archived');
create type public.expense_status as enum ('draft','submitted','under_review','approved','rejected','paid');
create type public.assignment_status as enum ('assigned','acknowledged','declined','completed');
create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, created_at timestamptz not null default now());
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, organization_id uuid not null references organizations(id), role member_role not null default 'handler', handler_id text unique, full_name text not null, email text not null, phone text, job_title text, team text, photo_path text, status text not null default 'active' check(status in ('active','inactive')), emergency_contact jsonb, joined_at date not null default current_date, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.events(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), event_code text not null unique, name text not null, type text not null, description text, event_date date not null, start_time time not null, end_time time not null, venue text not null, address text not null, city text not null, latitude numeric(9,6), longitude numeric(9,6), organizer_name text, organizer_contact text, required_handlers int not null default 0 check(required_handlers>=0), instructions text, dress_code text, emergency_contact text, reimbursement_rules jsonb not null default '{}', status event_status not null default 'draft', created_by uuid not null references profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_time>start_time));
create index events_org_date_idx on events(organization_id,event_date,status);
create table public.event_assignments(id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id) on delete cascade, handler_id uuid not null references profiles(id), responsibility text not null default 'Event Handler', status assignment_status not null default 'assigned', assigned_at timestamptz not null default now(), unique(event_id,handler_id));
create index assignment_handler_idx on event_assignments(handler_id,event_id);
create table public.attendance(id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id), handler_id uuid not null references profiles(id), check_in_at timestamptz, check_out_at timestamptz, check_in_photo_path text, check_out_photo_path text, check_in_lat numeric(9,6), check_in_lng numeric(9,6), check_out_lat numeric(9,6), check_out_lng numeric(9,6), arrival_status text check(arrival_status in ('early','on_time','late','review_required')), review_required boolean not null default false, review_note text, created_at timestamptz not null default now(), unique(event_id,handler_id));
create table public.checklist_items(id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id) on delete cascade, title text not null, priority text not null default 'normal' check(priority in ('low','normal','high','urgent')), assigned_to uuid references profiles(id), completed_at timestamptz, completed_by uuid references profiles(id), note text, sort_order int not null default 0, created_at timestamptz not null default now());
create unique index checklist_event_title_idx on checklist_items(event_id,title);
create table public.expenses(id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id), handler_id uuid not null references profiles(id), category text not null check(category in ('Cab/Travel','Food','Printing','Materials','Local Transport','Other')), amount numeric(12,2) not null check(amount>0), expense_date date not null, description text not null, receipt_path text, status expense_status not null default 'submitted', reviewer_id uuid references profiles(id), review_note text, reviewed_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), recipient_id uuid not null references profiles(id) on delete cascade, title text not null, body text not null, kind text not null, href text, read_at timestamptz, created_at timestamptz not null default now());
create index notifications_recipient_idx on notifications(recipient_id,read_at,created_at desc);
create table public.digital_ids(profile_id uuid primary key references profiles(id) on delete cascade, verification_token uuid unique not null default gen_random_uuid(), valid_until date, created_at timestamptz not null default now());
create table public.event_timeline(id bigint generated always as identity primary key, organization_id uuid not null references organizations(id), event_id uuid references events(id), actor_id uuid references profiles(id), action text not null, details jsonb not null default '{}', created_at timestamptz not null default now());
create table public.audit_log(id bigint generated always as identity primary key, organization_id uuid not null references organizations(id), actor_id uuid references profiles(id), action text not null, target_type text not null, target_id text, details jsonb not null default '{}', created_at timestamptz not null default now());
create index audit_org_time_idx on audit_log(organization_id,created_at desc);

-- Append-only server-side audit trail. Details are deliberately allow-listed to avoid copying PII.
create function public.capture_audit() returns trigger language plpgsql security definer set search_path=public as $$
declare v_row jsonb; v_org uuid; v_event uuid; v_target text;
begin
 v_row:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 if v_row ? 'organization_id' then v_org:=(v_row->>'organization_id')::uuid; end if;
 if v_row ? 'event_id' then v_event:=(v_row->>'event_id')::uuid; end if;
 if v_org is null and v_event is not null then select organization_id into v_org from events where id=v_event; end if;
 if v_org is null and v_row ? 'id' then select organization_id into v_org from profiles where id=(v_row->>'id')::uuid; end if;
 if v_org is null then if TG_OP='DELETE' then return OLD; else return NEW; end if; end if;
 v_target:=coalesce(v_row->>'id',v_row->>'profile_id');
 insert into audit_log(organization_id,actor_id,action,target_type,target_id,details) values(v_org,auth.uid(),lower(TG_OP)||'_'||TG_TABLE_NAME,TG_TABLE_NAME,v_target,jsonb_strip_nulls(jsonb_build_object('event_code',v_row->'event_code','name',v_row->'name','handler_id',v_row->'handler_id','status',v_row->'status','amount',v_row->'amount','category',v_row->'category','title',v_row->'title')));
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;
create trigger audit_events after insert or update or delete on events for each row execute function public.capture_audit();
create trigger audit_profiles after insert or update or delete on profiles for each row execute function public.capture_audit();
create trigger audit_assignments after insert or update or delete on event_assignments for each row execute function public.capture_audit();
create trigger audit_attendance after insert or update or delete on attendance for each row execute function public.capture_audit();
create trigger audit_checklist after insert or update or delete on checklist_items for each row execute function public.capture_audit();
create trigger audit_expenses after insert or update or delete on expenses for each row execute function public.capture_audit();
create trigger audit_notifications after insert or update or delete on notifications for each row execute function public.capture_audit();

create function public.capture_event_timeline() returns trigger language plpgsql security definer set search_path=public as $$
declare v_row jsonb; v_event uuid; v_org uuid; v_action text; v_details jsonb;
begin
 v_row:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 if TG_TABLE_NAME='events' then
  if TG_OP='UPDATE' and NEW.status='completed' and OLD.status is distinct from NEW.status then v_event:=NEW.id;v_org:=NEW.organization_id;v_action:='event_completed';v_details:=jsonb_build_object('event_code',NEW.event_code,'name',NEW.name);end if;
 elsif TG_TABLE_NAME='event_assignments' then
  v_event:=(v_row->>'event_id')::uuid;v_action:=case when TG_OP='INSERT' then 'handler_assigned' else 'assignment_updated' end;v_details:=jsonb_build_object('handler_id',v_row->>'handler_id','status',v_row->>'status');
 elsif TG_TABLE_NAME='expenses' then
  v_event:=(v_row->>'event_id')::uuid;v_action:=case when TG_OP='INSERT' then 'expense_submitted' else 'expense_status_updated' end;v_details:=jsonb_build_object('expense_id',v_row->>'id','amount',v_row->>'amount','status',v_row->>'status');
 end if;
 if v_event is not null and v_org is null then select organization_id into v_org from events where id=v_event;end if;
 if v_org is not null and v_action is not null then insert into event_timeline(organization_id,event_id,actor_id,action,details) values(v_org,v_event,auth.uid(),v_action,coalesce(v_details,'{}'));end if;
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;
create trigger timeline_event_complete after update of status on events for each row execute function public.capture_event_timeline();
create trigger timeline_assignments after insert or update of status on event_assignments for each row execute function public.capture_event_timeline();
create trigger timeline_expenses after insert or update of status on expenses for each row execute function public.capture_event_timeline();

create function public.current_profile() returns public.profiles language sql stable security definer set search_path=public as $$ select * from profiles where id=auth.uid() $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and status='active') $$;
create function public.can_access_event(eid uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.is_admin() or exists(select 1 from event_assignments a join profiles p on p.id=a.handler_id where a.event_id=eid and a.handler_id=auth.uid() and p.status='active') $$;

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table events enable row level security;
alter table event_assignments enable row level security;
alter table attendance enable row level security;
alter table checklist_items enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;
alter table digital_ids enable row level security;
alter table event_timeline enable row level security;
alter table audit_log enable row level security;

create policy org_read on organizations for select using (id=(select organization_id from profiles where id=auth.uid()));
create policy profile_read on profiles for select using (id=auth.uid() or (public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid())));
create policy profile_admin_write on profiles for all using (public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) with check (public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid()));
create policy event_read on events for select using (organization_id=(select organization_id from profiles where id=auth.uid()) and (public.is_admin() or public.can_access_event(id)));
create policy event_admin_write on events for all using (public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) with check (public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid()));
create policy assignment_read on event_assignments for select using (handler_id=auth.uid() or (public.is_admin() and exists(select 1 from events e where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()))));
create policy assignment_admin_write on event_assignments for all using (public.is_admin() and exists(select 1 from events e where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()))) with check (public.is_admin() and exists(select 1 from events e join profiles p on p.id=event_assignments.handler_id where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()) and p.organization_id=e.organization_id));
create policy attendance_read on attendance for select using (public.is_admin() or handler_id=auth.uid());
create policy attendance_self_insert on attendance for insert with check(handler_id=auth.uid() and public.can_access_event(event_id));
-- Handlers cannot write attendance rows directly; record_attendance is the only handler write path.
create policy attendance_admin_update on attendance for all using(public.is_admin() and exists(select 1 from events e where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()))) with check(public.is_admin() and exists(select 1 from events e join profiles p on p.id=attendance.handler_id where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()) and p.organization_id=e.organization_id));
create policy checklist_read on checklist_items for select using(public.can_access_event(event_id));
create policy checklist_admin_write on checklist_items for all using(public.is_admin() and exists(select 1 from events e where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()))) with check(public.is_admin() and exists(select 1 from events e where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid())) and (assigned_to is null or exists(select 1 from profiles p where p.id=assigned_to and p.organization_id=(select organization_id from profiles where id=auth.uid()))));
-- Completion is performed only through complete_checklist so the database owns the timestamp/actor.
create policy expense_read on expenses for select using(public.is_admin() or handler_id=auth.uid());
create policy expense_self_insert on expenses for insert with check(handler_id=auth.uid() and public.can_access_event(event_id) and status in ('draft','submitted') and reviewer_id is null and reviewed_at is null and paid_at is null);
create policy expense_self_update on expenses for update using(handler_id=auth.uid() and status='draft' and public.can_access_event(event_id)) with check(handler_id=auth.uid() and status='draft' and public.can_access_event(event_id));
create policy expense_admin_update on expenses for all using(public.is_admin() and exists(select 1 from events e where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()))) with check(public.is_admin() and exists(select 1 from events e join profiles p on p.id=expenses.handler_id where e.id=event_id and e.organization_id=(select organization_id from profiles where id=auth.uid()) and p.organization_id=e.organization_id));
create policy notification_read on notifications for select using(recipient_id=auth.uid() or (public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid())));
-- Marking read goes through mark_notification_read; clients cannot rewrite notification content.
create policy notification_admin_insert on notifications for insert with check(public.is_admin() and notifications.organization_id=(select organization_id from profiles where id=auth.uid()) and exists(select 1 from profiles p where p.id=notifications.recipient_id and p.organization_id=notifications.organization_id));
create policy digital_id_read on digital_ids for select using(profile_id=auth.uid() or (public.is_admin() and exists(select 1 from profiles p where p.id=profile_id and p.organization_id=(select organization_id from profiles where id=auth.uid()))));
create policy timeline_read on event_timeline for select using((event_id is not null and public.can_access_event(event_id)) or (public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid())));
create policy audit_admin_read on audit_log for select using(public.is_admin() and organization_id=(select organization_id from profiles where id=auth.uid()));

-- SECURITY DEFINER RPC: ignores client timestamps; DB clock is authoritative. Call only after private camera capture upload.
create function public.record_attendance(p_event_id uuid,p_photo_path text,p_lat numeric default null,p_lng numeric default null,p_kind text default 'check_in') returns public.attendance
language plpgsql security definer set search_path=public as $$
declare v_row public.attendance; v_now timestamptz := clock_timestamp(); v_start timestamptz;
begin
 if auth.uid() is null or not public.can_access_event(p_event_id) then raise exception 'not_authorized'; end if;
 if p_kind not in ('check_in','check_out') or p_photo_path not like auth.uid()::text||'/%' then raise exception 'invalid_submission'; end if;
 if (p_lat is not null and p_lat not between -90 and 90) or (p_lng is not null and p_lng not between -180 and 180) then raise exception 'invalid_location'; end if;
 select (event_date + start_time) at time zone 'Asia/Kolkata' into v_start from events where id=p_event_id and status='active';
 if v_start is null then raise exception 'event_not_active'; end if;
 insert into attendance(event_id,handler_id) values(p_event_id,auth.uid()) on conflict(event_id,handler_id) do nothing;
 if p_kind='check_in' then
  update attendance set check_in_at=v_now,check_in_photo_path=p_photo_path,check_in_lat=p_lat,check_in_lng=p_lng,
   arrival_status=case when v_now < v_start-interval '15 minutes' then 'early' when v_now <= v_start+interval '10 minutes' then 'on_time' else 'late' end
   where event_id=p_event_id and handler_id=auth.uid() and check_in_at is null returning * into v_row;
 else
  update attendance set check_out_at=v_now,check_out_photo_path=p_photo_path,check_out_lat=p_lat,check_out_lng=p_lng
   where event_id=p_event_id and handler_id=auth.uid() and check_in_at is not null and check_out_at is null returning * into v_row;
 end if;
 if v_row.id is null then raise exception 'attendance_state_invalid'; end if;
 insert into event_timeline(organization_id,event_id,actor_id,action,details) select organization_id,p_event_id,auth.uid(),p_kind,jsonb_build_object('attendance_id',v_row.id) from events where id=p_event_id;
 return v_row;
end $$;
revoke all on function public.record_attendance(uuid,text,numeric,numeric,text) from public;
grant execute on function public.record_attendance(uuid,text,numeric,numeric,text) to authenticated;

create function public.complete_checklist(p_item_id uuid,p_note text default null) returns public.checklist_items
language plpgsql security definer set search_path=public as $$
declare v_item public.checklist_items;
begin
 update checklist_items set completed_at=clock_timestamp(),completed_by=auth.uid(),note=coalesce(p_note,note)
 where id=p_item_id and assigned_to=auth.uid() and completed_at is null and public.can_access_event(event_id)
 returning * into v_item;
 if v_item.id is null then raise exception 'not_authorized_or_already_complete'; end if;
 insert into event_timeline(organization_id,event_id,actor_id,action,details) select organization_id,v_item.event_id,auth.uid(),'task_completed',jsonb_build_object('checklist_item_id',v_item.id,'title',v_item.title) from events where id=v_item.event_id;
 return v_item;
end $$;
revoke all on function public.complete_checklist(uuid,text) from public;
grant execute on function public.complete_checklist(uuid,text) to authenticated;

create function public.mark_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_notification_id and recipient_id=auth.uid();
 if not found then raise exception 'not_authorized'; end if;
end $$;
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('attendance','attendance',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('receipts','receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('documents','documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
create policy private_upload_own_folder on storage.objects for insert to authenticated with check(bucket_id in ('attendance','receipts','documents') and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_read_own_folder on storage.objects for select to authenticated using(bucket_id in ('attendance','receipts','documents') and ((storage.foldername(name))[1]=auth.uid()::text or (public.is_admin() and exists(select 1 from profiles p where p.id::text=(storage.foldername(name))[1] and p.organization_id=(select organization_id from profiles where id=auth.uid())))));
create policy private_admin_delete on storage.objects for delete to authenticated using(bucket_id in ('attendance','receipts','documents') and public.is_admin() and exists(select 1 from profiles p where p.id::text=(storage.foldername(name))[1] and p.organization_id=(select organization_id from profiles where id=auth.uid())));
