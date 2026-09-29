-- Add city-scoped administration and Skillo's event support entities.
alter type public.member_role rename to member_role_legacy;
create type public.member_role as enum ('super_admin','city_admin','handler');
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type public.member_role using (case when role::text='admin' then 'super_admin' else role::text end)::public.member_role;
alter table public.profiles alter column role set default 'handler';

create table public.cities(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
 name text not null, code text not null check(code ~ '^[A-Z]{3}$'), active boolean not null default true,
 city_admin_id uuid references profiles(id) on delete set null, reimbursement_rules jsonb not null default '{}',
 local_contacts jsonb not null default '[]', inventory_base text, created_at timestamptz not null default now(),
 unique(organization_id,code), unique(city_admin_id)
);
alter table public.profiles add column home_city_id uuid references cities(id);
alter table public.events add column city_id uuid references cities(id);
alter table public.events alter column event_code drop not null;
alter table public.audit_log add column city_id uuid references cities(id);

create table public.clients(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
 name text not null, company text, contact_person text, phone text, email text, home_city_id uuid references cities(id),
 preferred_activities text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activities(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
 name text not null, active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,name)
);
create table public.venues(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
 city_id uuid not null references cities(id), client_id uuid references clients(id), name text not null,
 address text not null, venue_type text, contact_name text, contact_phone text, access_instructions text,
 created_at timestamptz not null default now()
);
alter table public.events add column client_id uuid references clients(id);
alter table public.events add column venue_id uuid references venues(id);
alter table public.events add column activity_id uuid references activities(id);
alter table public.events add column venue_access_time time;
alter table public.events add column expected_arrival_time time;
alter table public.events add column expected_participants int check(expected_participants is null or expected_participants>=0);
alter table public.events add column actual_participants int check(actual_participants is null or actual_participants>=0);
alter table public.events add column age_group text;
alter table public.events add column theme text;

create table public.inventory_items(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
 city_id uuid not null references cities(id), name text not null, unit text not null default 'unit', quantity_on_hand numeric(12,2) not null default 0 check(quantity_on_hand>=0),
 reorder_level numeric(12,2) not null default 0 check(reorder_level>=0), active boolean not null default true, unique(city_id,name)
);
create table public.event_inventory(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id) on delete cascade,
 inventory_item_id uuid not null references inventory_items(id), required numeric(12,2) not null default 0,
 taken numeric(12,2) not null default 0, returned numeric(12,2) not null default 0,
 damaged numeric(12,2) not null default 0, missing numeric(12,2) not null default 0, unique(event_id,inventory_item_id)
);
create table public.inventory_transactions(
 id uuid primary key default gen_random_uuid(), inventory_item_id uuid not null references inventory_items(id), event_id uuid references events(id),
 actor_id uuid references profiles(id), quantity_delta numeric(12,2) not null, reason text not null, created_at timestamptz not null default now()
);
create table public.photo_categories(id text primary key, label text not null);
insert into public.photo_categories(id,label) values('arrival','Arrival'),('setup','Setup'),('activity','Activity in Progress'),('creations','Finished Creations'),('cleanup','Clean-up'),('checkout','Check-out'),('receipt','Receipt'),('highlight','Event Highlight') on conflict do nothing;
create table public.event_photos(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id) on delete cascade,
 handler_id uuid not null references profiles(id), category text not null references photo_categories(id), storage_path text not null,
 caption text, created_at timestamptz not null default now()
);
create function public.validate_city_admin() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid;v_role public.member_role;v_city uuid;
begin
 if new.city_admin_id is null then return new;end if;
 select organization_id,role,home_city_id into v_org,v_role,v_city from profiles where id=new.city_admin_id;
 if v_org is distinct from new.organization_id or v_role is distinct from 'city_admin' or v_city is distinct from new.id then raise exception 'city_admin_must_belong_to_city';end if;
 return new;
end $$;
create trigger city_admin_guard before insert or update of city_admin_id,organization_id on cities for each row execute function public.validate_city_admin();
create function public.validate_event_references() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid;v_city uuid;
begin
 if new.client_id is not null then select organization_id into v_org from clients where id=new.client_id;if v_org is distinct from new.organization_id then raise exception 'client_organization_mismatch';end if;end if;
 if new.venue_id is not null then select organization_id,city_id into v_org,v_city from venues where id=new.venue_id;if v_org is distinct from new.organization_id or v_city is distinct from new.city_id then raise exception 'venue_city_mismatch';end if;end if;
 if new.activity_id is not null then select organization_id into v_org from activities where id=new.activity_id;if v_org is distinct from new.organization_id then raise exception 'activity_organization_mismatch';end if;end if;
 return new;
end $$;
create trigger event_reference_guard before insert or update of organization_id,city_id,client_id,venue_id,activity_id on events for each row execute function public.validate_event_references();
create function public.validate_expense_handler() returns trigger language plpgsql security definer set search_path=public as $$
declare v_event_org uuid;v_handler_org uuid;
begin
 select organization_id into v_event_org from events where id=new.event_id;select organization_id into v_handler_org from profiles where id=new.handler_id;
 if v_event_org is null or v_handler_org is distinct from v_event_org then raise exception 'expense_handler_event_mismatch';end if;
 return new;
end $$;
create trigger expense_handler_guard before insert or update of event_id,handler_id on expenses for each row execute function public.validate_expense_handler();
create table public.reimbursements(
 id uuid primary key default gen_random_uuid(), expense_id uuid not null unique references expenses(id) on delete cascade,
 organization_id uuid not null references organizations(id), city_id uuid references cities(id), amount numeric(12,2) not null check(amount>0),
 status public.expense_status not null default 'submitted', reviewer_id uuid references profiles(id), review_note text,
 reviewed_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now()
);
create function public.sync_expense_reimbursement() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_city uuid;
begin
 select organization_id,city_id into v_org,v_city from events where id=new.event_id;
 insert into reimbursements(expense_id,organization_id,city_id,amount,status,reviewer_id,review_note,reviewed_at,paid_at)
 values(new.id,v_org,v_city,new.amount,new.status,new.reviewer_id,new.review_note,new.reviewed_at,new.paid_at)
 on conflict(expense_id) do update set city_id=excluded.city_id,amount=excluded.amount,status=excluded.status,reviewer_id=excluded.reviewer_id,review_note=excluded.review_note,reviewed_at=excluded.reviewed_at,paid_at=excluded.paid_at;
 return new;
end $$;
create trigger expenses_reimbursement after insert or update of amount,status,reviewer_id,review_note,reviewed_at,paid_at on expenses for each row execute function public.sync_expense_reimbursement();
create table public.checklist_templates(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
 event_type text not null, title text not null, priority text not null default 'normal', sort_order int not null default 0,
 unique(organization_id,event_type,title)
);

create table public.id_counters(
 organization_id uuid not null references organizations(id) on delete cascade, city_id uuid not null references cities(id),
 id_kind text not null check(id_kind in ('handler','event')), year int not null default 0, last_value int not null default 0,
 primary key(organization_id,city_id,id_kind,year)
);
create or replace function public.next_city_code(p_org uuid,p_city uuid,p_kind text,p_year int default 0) returns int
language plpgsql security definer set search_path=public as $$
declare v_next int;
begin
 insert into id_counters(organization_id,city_id,id_kind,year,last_value) values(p_org,p_city,p_kind,p_year,1)
 on conflict(organization_id,city_id,id_kind,year) do update set last_value=id_counters.last_value+1 returning last_value into v_next;
 return v_next;
end $$;
revoke all on function public.next_city_code(uuid,uuid,text,int) from public;

create or replace function public.assign_profile_handler_id() returns trigger language plpgsql security definer set search_path=public as $$
declare v_code text; v_n int;
begin
 if new.role='handler' then
  if new.handler_id is not null then raise exception 'handler_id_server_generated'; end if;
  if new.home_city_id is null then raise exception 'handler_city_required'; end if;
  select code into v_code from cities where id=new.home_city_id and organization_id=new.organization_id and active;
  if v_code is null then raise exception 'handler_city_invalid'; end if;
  v_n:=next_city_code(new.organization_id,new.home_city_id,'handler',0);
  new.handler_id:='SKO-'||v_code||'-'||lpad(v_n::text,4,'0');
 end if;
 return new;
end $$;
create trigger profile_handler_id before insert on profiles for each row execute function public.assign_profile_handler_id();

create or replace function public.assign_event_code() returns trigger language plpgsql security definer set search_path=public as $$
declare v_code text; v_n int; v_year int;
begin
 if new.city_id is null then raise exception 'event_city_required'; end if;
 select code into v_code from cities where id=new.city_id and organization_id=new.organization_id and active;
 if v_code is null then raise exception 'event_city_invalid'; end if;
 v_year:=extract(year from new.event_date)::int;
 v_n:=next_city_code(new.organization_id,new.city_id,'event',v_year);
 new.event_code:='EVT-'||v_code||'-'||v_year::text||'-'||lpad(v_n::text,3,'0');
 return new;
end $$;
create trigger event_code_before_insert before insert on events for each row execute function public.assign_event_code();

create or replace function public.create_digital_id_for_handler() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.role='handler' then insert into digital_ids(profile_id,valid_until) values(new.id,(current_date + interval '1 year')::date) on conflict(profile_id) do nothing; end if;
 return new;
end $$;
create trigger profile_digital_id after insert on profiles for each row execute function public.create_digital_id_for_handler();

create or replace function public.create_event_checklist() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into checklist_items(event_id,title,priority,sort_order)
 select new.id,title,priority,sort_order from checklist_templates where organization_id=new.organization_id and event_type=new.type order by sort_order
 on conflict(event_id,title) do nothing;
 return new;
end $$;
create trigger event_checklist after insert on events for each row execute function public.create_event_checklist();

create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role='super_admin' and status='active') $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role in ('super_admin','city_admin') and status='active') $$;
create or replace function public.can_manage_city(p_city uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p where p.id=auth.uid() and p.status='active' and p.role='super_admin' and p.organization_id=(select organization_id from cities where id=p_city))
 or exists(select 1 from profiles p join cities c on c.id=p_city where p.id=auth.uid() and p.status='active' and p.role='city_admin' and p.organization_id=c.organization_id and (p.home_city_id=p_city or c.city_admin_id=p.id)) $$;
create or replace function public.can_manage_event(p_event uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from events e where e.id=p_event and (public.is_super_admin() or public.can_manage_city(e.city_id))) $$;
create or replace function public.can_access_event(eid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.can_manage_event(eid) or exists(select 1 from event_assignments a join profiles p on p.id=a.handler_id where a.event_id=eid and a.handler_id=auth.uid() and p.status='active') $$;
create or replace function public.complete_checklist(p_item_id uuid,p_note text default null) returns public.checklist_items
language plpgsql security definer set search_path=public as $$
declare v_item public.checklist_items;
begin
 update checklist_items set completed_at=clock_timestamp(),completed_by=auth.uid(),note=coalesce(p_note,note)
 where id=p_item_id and (assigned_to is null or assigned_to=auth.uid()) and completed_at is null and public.can_access_event(event_id)
 returning * into v_item;
 if v_item.id is null then raise exception 'not_authorized_or_already_complete';end if;
 insert into event_timeline(organization_id,event_id,actor_id,action,details) select organization_id,v_item.event_id,auth.uid(),'task_completed',jsonb_build_object('checklist_item_id',v_item.id,'title',v_item.title) from events where id=v_item.event_id;
 return v_item;
end $$;
drop type public.member_role_legacy;

drop policy profile_read on profiles;
create policy profile_read on profiles for select using(id=auth.uid() or (public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) or (public.can_manage_city(home_city_id) and role='handler'));
drop policy profile_admin_write on profiles;
create policy profile_admin_write on profiles for all using((public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) or (role='handler' and public.can_manage_city(home_city_id))) with check((public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) or (role='handler' and public.can_manage_city(home_city_id) and organization_id=(select organization_id from profiles where id=auth.uid())));
drop policy event_read on events;
create policy event_read on events for select using(organization_id=(select organization_id from profiles where id=auth.uid()) and (public.can_manage_city(city_id) or (city_id is null and public.is_super_admin()) or exists(select 1 from event_assignments a where a.event_id=id and a.handler_id=auth.uid())));
drop policy event_admin_write on events;
create policy event_admin_write on events for all using(organization_id=(select organization_id from profiles where id=auth.uid()) and (public.can_manage_city(city_id) or (city_id is null and public.is_super_admin()))) with check(organization_id=(select organization_id from profiles where id=auth.uid()) and public.can_manage_city(city_id));
drop policy assignment_read on event_assignments;
create policy assignment_read on event_assignments for select using(handler_id=auth.uid() or public.can_manage_event(event_id));
drop policy assignment_admin_write on event_assignments;
create policy assignment_admin_write on event_assignments for all using(public.can_manage_event(event_id)) with check(public.can_manage_event(event_id) and exists(select 1 from profiles p where p.id=handler_id and p.organization_id=(select organization_id from events where id=event_id)));
drop policy attendance_read on attendance;
create policy attendance_read on attendance for select using(handler_id=auth.uid() or public.can_manage_event(event_id));
drop policy attendance_self_insert on attendance;
-- Attendance INSERT is available only through SECURITY DEFINER record_attendance.
drop policy attendance_admin_update on attendance;
create policy attendance_admin_update on attendance for all using(public.can_manage_event(event_id)) with check(public.can_manage_event(event_id));
drop policy checklist_admin_write on checklist_items;
create policy checklist_admin_write on checklist_items for all using(public.can_manage_event(event_id)) with check(public.can_manage_event(event_id) and (assigned_to is null or exists(select 1 from profiles p where p.id=assigned_to and p.organization_id=(select organization_id from events where id=event_id))));
drop policy expense_read on expenses;
create policy expense_read on expenses for select using(handler_id=auth.uid() or public.can_manage_event(event_id));
drop policy expense_self_insert on expenses;
drop policy expense_admin_update on expenses;
create policy expense_admin_review_read on expenses for select using(handler_id=auth.uid() or public.can_manage_event(event_id));
drop policy notification_read on notifications;
create policy notification_read on notifications for select using(recipient_id=auth.uid() or (public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) or exists(select 1 from profiles p where p.id=recipient_id and public.can_manage_city(p.home_city_id)));
drop policy notification_admin_insert on notifications;
create policy notification_admin_insert on notifications for insert with check(organization_id=(select organization_id from profiles where id=auth.uid()) and exists(select 1 from profiles p where p.id=recipient_id and p.organization_id=notifications.organization_id and (public.is_super_admin() or (p.role='handler' and public.can_manage_city(p.home_city_id)))));
drop policy digital_id_read on digital_ids;
create policy digital_id_read on digital_ids for select using(profile_id=auth.uid() or exists(select 1 from profiles p where p.id=profile_id and public.can_manage_city(p.home_city_id)));
drop policy timeline_read on event_timeline;
create policy timeline_read on event_timeline for select using((event_id is not null and public.can_access_event(event_id)) or (event_id is null and public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())));
drop policy audit_admin_read on audit_log;
create policy audit_admin_read on audit_log for select using((public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) or public.can_manage_city(city_id));

alter table cities enable row level security;
alter table clients enable row level security;
alter table activities enable row level security;
alter table venues enable row level security;
alter table inventory_items enable row level security;
alter table event_inventory enable row level security;
alter table inventory_transactions enable row level security;
alter table event_photos enable row level security;
alter table reimbursements enable row level security;
alter table checklist_templates enable row level security;
create policy city_read on cities for select using(public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid()) or public.can_manage_city(id));
create policy city_admin_write on cities for all using(public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) with check(public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid()));
create policy clients_city_access on clients for all using((public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) or public.can_manage_city(home_city_id)) with check((public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) or (organization_id=(select organization_id from profiles where id=auth.uid()) and public.can_manage_city(home_city_id)));
create policy activities_org_read on activities for select using(organization_id=(select organization_id from profiles where id=auth.uid()));
create policy activities_super_write on activities for all using(public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) with check(public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid()));
create policy venue_city_access on venues for all using(public.can_manage_city(city_id)) with check(public.can_manage_city(city_id));
create policy inventory_city_access on inventory_items for all using(public.can_manage_city(city_id)) with check(public.can_manage_city(city_id));
create policy event_inventory_access on event_inventory for all using(public.can_access_event(event_id)) with check(public.can_manage_event(event_id));
create policy inventory_tx_read on inventory_transactions for select using(public.can_manage_city((select city_id from inventory_items where id=inventory_item_id)));
create policy inventory_tx_admin on inventory_transactions for insert with check(public.can_manage_city((select city_id from inventory_items where id=inventory_item_id)));
create policy photos_event_read on event_photos for select using(handler_id=auth.uid() or public.can_manage_event(event_id));
create policy photos_assigned_upload on event_photos for insert with check(handler_id=auth.uid() and public.can_access_event(event_id));
create policy reimbursement_read on reimbursements for select using(exists(select 1 from expenses x where x.id=expense_id and (x.handler_id=auth.uid() or public.can_manage_event(x.event_id))));
create policy checklist_template_read on checklist_templates for select using(organization_id=(select organization_id from profiles where id=auth.uid()));
create policy checklist_template_write on checklist_templates for all using(public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid())) with check(public.is_super_admin() and organization_id=(select organization_id from profiles where id=auth.uid()));

create function public.review_expense(p_expense_id uuid,p_decision text,p_reason text default null) returns public.expenses
language plpgsql security definer set search_path=public as $$
declare v_expense public.expenses;
begin
 if p_decision not in ('approved','rejected','paid') then raise exception 'invalid_expense_decision';end if;
 if p_decision='rejected' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'rejection_reason_required';end if;
 if p_decision='paid' then
  update expenses set status='paid',paid_at=clock_timestamp() where id=p_expense_id and status='approved' and public.can_manage_event(event_id) returning * into v_expense;
 else
  update expenses set status=p_decision::expense_status,reviewer_id=auth.uid(),review_note=case when p_decision='rejected' then trim(p_reason) else null end,reviewed_at=clock_timestamp()
  where id=p_expense_id and status in ('submitted','under_review') and public.can_manage_event(event_id) returning * into v_expense;
 end if;
 if v_expense.id is null then raise exception 'expense_not_reviewable_or_not_authorized';end if;
 insert into notifications(organization_id,recipient_id,title,body,kind,href) select e.organization_id,v_expense.handler_id,
  case when p_decision='approved' then 'Expense approved' when p_decision='rejected' then 'Expense needs attention' else 'Reimbursement paid' end,
  case when p_decision='approved' then 'Your expense of ₹'||v_expense.amount||' was approved.' when p_decision='rejected' then 'Your expense of ₹'||v_expense.amount||' was declined: '||trim(p_reason) else 'Your expense of ₹'||v_expense.amount||' has been marked paid.' end,
  'expense_update','/handler/expenses' from events e where e.id=v_expense.event_id;
 return v_expense;
end $$;
revoke all on function public.review_expense(uuid,text,text) from public;
grant execute on function public.review_expense(uuid,text,text) to authenticated;
create function public.submit_expense(p_event_id uuid,p_category text,p_amount numeric,p_expense_date date,p_description text,p_receipt_path text) returns public.expenses
language plpgsql security definer set search_path=public as $$
declare v_expense public.expenses;
begin
 if not exists(select 1 from profiles where id=auth.uid() and role='handler' and status='active') then raise exception 'handler_required';end if;
 if not exists(select 1 from event_assignments where event_id=p_event_id and handler_id=auth.uid() and status in ('assigned','acknowledged')) then raise exception 'event_assignment_required';end if;
 if p_category not in ('Cab/Travel','Food','Printing','Materials','Local Transport','Other') or p_amount<=0 or p_amount>1000000 or length(trim(p_description))<3 then raise exception 'expense_details_invalid';end if;
 if p_receipt_path not like auth.uid()::text||'/'||p_event_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='receipts' and name=p_receipt_path) then raise exception 'receipt_capture_required';end if;
 insert into expenses(event_id,handler_id,category,amount,expense_date,description,receipt_path,status)
 values(p_event_id,auth.uid(),p_category,p_amount,p_expense_date,trim(p_description),p_receipt_path,'submitted') returning * into v_expense;
 return v_expense;
end $$;
revoke all on function public.submit_expense(uuid,text,numeric,date,text,text) from public;
grant execute on function public.submit_expense(uuid,text,numeric,date,text,text) to authenticated;
create or replace function public.notify_admin_of_expense() returns trigger language plpgsql security definer set search_path=public as $$
declare v_city uuid;v_name text;
begin
 select city_id into v_city from events where id=new.event_id;select name into v_name from events where id=new.event_id;
 insert into notifications(organization_id,recipient_id,title,body,kind,href)
 select p.organization_id,p.id,'Expense submitted',new.category||' · ₹'||new.amount||' submitted for '||v_name,'expense_submitted','/admin/expenses'
 from profiles p left join cities c on c.id=v_city where p.organization_id=(select organization_id from events where id=new.event_id) and p.status='active' and (p.role='super_admin' or (p.role='city_admin' and (p.home_city_id=v_city or c.city_admin_id=p.id)));
 return new;
end $$;
create trigger expense_admin_notification after insert on expenses for each row execute function public.notify_admin_of_expense();

create or replace function public.capture_audit() returns trigger language plpgsql security definer set search_path=public as $$
declare v_row jsonb; v_org uuid; v_event uuid; v_city uuid; v_target text;
begin
 v_row:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 if v_row ? 'organization_id' then v_org:=(v_row->>'organization_id')::uuid; end if;
 if v_row ? 'event_id' then v_event:=(v_row->>'event_id')::uuid; end if;
 if v_row ? 'city_id' then v_city:=(v_row->>'city_id')::uuid; end if;
 if v_city is null and v_row ? 'home_city_id' and v_row->>'home_city_id' is not null then v_city:=(v_row->>'home_city_id')::uuid; end if;
 if v_org is null and v_event is not null then select organization_id,city_id into v_org,v_city from events where id=v_event; end if;
 if v_org is null and v_row ? 'id' then select organization_id,home_city_id into v_org,v_city from profiles where id=(v_row->>'id')::uuid; end if;
 if v_org is null then if TG_OP='DELETE' then return OLD; else return NEW; end if; end if;
 v_target:=coalesce(v_row->>'id',v_row->>'profile_id');
 insert into audit_log(organization_id,city_id,actor_id,action,target_type,target_id,details) values(v_org,v_city,auth.uid(),lower(TG_OP)||'_'||TG_TABLE_NAME,TG_TABLE_NAME,v_target,jsonb_strip_nulls(jsonb_build_object('event_code',v_row->'event_code','name',v_row->'name','handler_id',v_row->'handler_id','status',v_row->'status','amount',v_row->'amount','category',v_row->'category','title',v_row->'title')));
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;

create policy private_city_read on storage.objects for select to authenticated using(bucket_id in ('attendance','receipts','documents') and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from profiles p where p.id::text=(storage.foldername(name))[1] and public.can_manage_city(p.home_city_id))));
drop policy private_read_own_folder on storage.objects;
drop policy private_admin_delete on storage.objects;
create policy private_admin_delete on storage.objects for delete to authenticated using(bucket_id in ('attendance','receipts','documents') and exists(select 1 from profiles p where p.id::text=(storage.foldername(name))[1] and ((public.is_super_admin() and p.organization_id=(select organization_id from profiles where id=auth.uid())) or public.can_manage_city(p.home_city_id))));
create trigger audit_cities after insert or update or delete on cities for each row execute function public.capture_audit();
create trigger audit_clients after insert or update or delete on clients for each row execute function public.capture_audit();
create trigger audit_venues after insert or update or delete on venues for each row execute function public.capture_audit();
create trigger audit_inventory after insert or update or delete on inventory_items for each row execute function public.capture_audit();

-- Internal counters are only touched by SECURITY DEFINER ID allocation functions.
alter table id_counters enable row level security;
alter table photo_categories enable row level security;
create policy photo_categories_authenticated_read on photo_categories for select to authenticated using(true);
