-- Public QR verification returns only the minimum information needed to verify a handler.
create or replace function public.verify_handler_id(p_token uuid)
returns table(is_active boolean, handler_id text, full_name text, job_title text, organization_name text, valid_until date)
language sql stable security definer set search_path=public as $$
 select (p.role='handler' and p.status='active' and (d.valid_until is null or d.valid_until>=current_date)),
        p.handler_id,p.full_name,p.job_title,o.name,d.valid_until
 from digital_ids d join profiles p on p.id=d.profile_id join organizations o on o.id=p.organization_id
 where d.verification_token=p_token
 limit 1
$$;
revoke all on function public.verify_handler_id(uuid) from public;
grant execute on function public.verify_handler_id(uuid) to anon, authenticated;

-- Attendance is tied to the authenticated handler and a real private storage object.
create or replace function public.record_attendance(p_event_id uuid,p_photo_path text,p_lat numeric default null,p_lng numeric default null,p_kind text default 'check_in') returns public.attendance
language plpgsql security definer set search_path=public as $$
declare v_row public.attendance;v_now timestamptz:=clock_timestamp();v_start timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and role='handler' and status='active') then raise exception 'active_handler_required';end if;
 if not exists(select 1 from event_assignments where event_id=p_event_id and handler_id=auth.uid() and status in ('assigned','acknowledged')) then raise exception 'event_assignment_required';end if;
 if p_kind not in ('check_in','check_out') or p_photo_path not like auth.uid()::text||'/'||p_event_id::text||'/%' then raise exception 'invalid_submission';end if;
 if not exists(select 1 from storage.objects where bucket_id='attendance' and name=p_photo_path) then raise exception 'attendance_photo_required';end if;
 if (p_lat is not null and p_lat not between -90 and 90) or (p_lng is not null and p_lng not between -180 and 180) then raise exception 'invalid_location';end if;
 select (event_date+start_time) at time zone 'Asia/Kolkata' into v_start from events where id=p_event_id and status='active';
 if v_start is null then raise exception 'event_not_active';end if;
 insert into attendance(event_id,handler_id) values(p_event_id,auth.uid()) on conflict(event_id,handler_id) do nothing;
 if p_kind='check_in' then
  update attendance set check_in_at=v_now,check_in_photo_path=p_photo_path,check_in_lat=p_lat,check_in_lng=p_lng,
   arrival_status=case when v_now<v_start-interval '15 minutes' then 'early' when v_now<=v_start+interval '10 minutes' then 'on_time' else 'late' end
  where event_id=p_event_id and handler_id=auth.uid() and check_in_at is null returning * into v_row;
 else
  update attendance set check_out_at=v_now,check_out_photo_path=p_photo_path,check_out_lat=p_lat,check_out_lng=p_lng
  where event_id=p_event_id and handler_id=auth.uid() and check_in_at is not null and check_out_at is null returning * into v_row;
 end if;
 if v_row.id is null then raise exception 'attendance_state_invalid';end if;
 insert into event_timeline(organization_id,event_id,actor_id,action,details) select organization_id,p_event_id,auth.uid(),p_kind,jsonb_build_object('attendance_id',v_row.id) from events where id=p_event_id;
 return v_row;
end $$;
revoke all on function public.record_attendance(uuid,text,numeric,numeric,text) from public;
grant execute on function public.record_attendance(uuid,text,numeric,numeric,text) to authenticated;

-- Unassigned event-level checklist items can be completed by an assigned handler;
-- handler-specific items remain restricted to their assignee.
create or replace function public.complete_checklist(p_item_id uuid,p_note text default null) returns public.checklist_items
language plpgsql security definer set search_path=public as $$
declare v_item public.checklist_items;
begin
 update checklist_items set completed_at=clock_timestamp(),completed_by=auth.uid(),note=coalesce(p_note,note)
 where id=p_item_id and completed_at is null and (assigned_to is null or assigned_to=auth.uid()) and public.can_access_event(event_id)
 returning * into v_item;
 if v_item.id is null then raise exception 'not_authorized_or_already_complete';end if;
 insert into event_timeline(organization_id,event_id,actor_id,action,details) select organization_id,v_item.event_id,auth.uid(),'task_completed',jsonb_build_object('checklist_item_id',v_item.id,'title',v_item.title) from events where id=v_item.event_id;
 return v_item;
end $$;
revoke all on function public.complete_checklist(uuid,text) from public;
grant execute on function public.complete_checklist(uuid,text) to authenticated;

create or replace function public.request_attendance_review(p_event_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare v_org uuid;v_city uuid;v_event_name text;v_count int;
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and role='handler' and status='active') then raise exception 'active_handler_required';end if;
 if length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>400 then raise exception 'review_reason_required';end if;
 if not exists(select 1 from event_assignments where event_id=p_event_id and handler_id=auth.uid() and status in ('assigned','acknowledged')) then raise exception 'event_assignment_required';end if;
 select organization_id,city_id,name into v_org,v_city,v_event_name from events where id=p_event_id and status='active';
 if v_org is null then raise exception 'event_not_active';end if;
 insert into notifications(organization_id,recipient_id,title,body,kind,href)
 select v_org,p.id,'Attendance review requested',coalesce((select handler_id from profiles where id=auth.uid()),'Handler')||' requested a check-in review for '||v_event_name||': '||trim(p_reason),'attendance_review','/admin/attendance'
 from profiles p left join cities c on c.id=v_city where p.organization_id=v_org and p.status='active' and (p.role='super_admin' or (p.role='city_admin' and (p.home_city_id=v_city or c.city_admin_id=p.id)));
 get diagnostics v_count=row_count;
 if v_count=0 then raise exception 'no_event_administrator_available';end if;
 insert into event_timeline(organization_id,event_id,actor_id,action,details) values(v_org,p_event_id,auth.uid(),'attendance_review_requested',jsonb_build_object('reason',trim(p_reason)));
end $$;
revoke all on function public.request_attendance_review(uuid,text) from public;
grant execute on function public.request_attendance_review(uuid,text) to authenticated;

