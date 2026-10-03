import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {HandlerEventWorkspace} from '@/components/event-detail';
export default async function HandlerEventPage({params}:{params:Promise<{eventId:string}>}){
  const {eventId}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)notFound();
  const {data:event,error}=await supabase.from('events').select('*,cities(name,code),legacy_client:clients(name),activity:activities(name),venue_record:venues!events_venue_id_fkey(name,address,google_place_id,latitude,longitude)').eq('id',eventId).maybeSingle();if(error||!event)notFound();
  const [assignmentResult,tasksResult,attendanceResult,timelineResult]=await Promise.all([
    supabase.from('event_assignments').select('id,handler_id,role,responsibility,status,profiles!event_assignments_handler_id_fkey(id,handler_id,full_name,job_title,email)').eq('event_id',eventId).eq('handler_id',user.id).maybeSingle(),
    supabase.from('checklist_items').select('id,title,priority,assigned_to,completed_at,note').eq('event_id',eventId).order('sort_order').limit(200),
    supabase.from('attendance').select('check_in_at,check_out_at,arrival_status').eq('event_id',eventId).eq('handler_id',user.id).maybeSingle(),
    supabase.from('event_timeline').select('id,actor_id,action,details,created_at,profiles(full_name)').eq('event_id',eventId).order('created_at').limit(200),
  ]);
  if(!assignmentResult.data)notFound();
  let leadDetails=null;
  if(assignmentResult.data.role==='lead'){
    const {data}=await supabase.from('event_lead_details').select('event_photo_path,amount_paid,payment_method,payment_screenshot_path').eq('event_id',eventId).maybeSingle();leadDetails=data;
  }
  return <HandlerEventWorkspace event={event as any} assignment={assignmentResult.data as any} items={(tasksResult.data??[]) as any} attendance={attendanceResult.data} timeline={(timelineResult.data??[]) as any} leadDetails={leadDetails as any}/>;
}
