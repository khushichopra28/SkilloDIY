import { notFound } from 'next/navigation';
import EventCreateForm from '@/components/event-create-form';
import { getEventFormOptions } from '@/lib/services/event-form-data';
import { createClient } from '@/lib/supabase/server';

export default async function EditEventPage({params}:{params:Promise<{eventId:string}>}){
  const {eventId}=await params,db=await createClient();
  const [eventResult,assignmentResult,detailsResult,options]=await Promise.all([
    db.from('events').select('id,name,type,activity_name,activity_id,activity:activities(name),client_name,description,city_id,event_date,venue,address,expected_arrival_time,expected_participants,age_group,theme,status').eq('id',eventId).maybeSingle(),
    db.from('event_assignments').select('handler_id,role').eq('event_id',eventId),
    db.from('event_lead_details').select('event_photo_path,amount_paid,payment_method,payment_screenshot_path').eq('event_id',eventId).maybeSingle(),
    getEventFormOptions(),
  ]);
  if(eventResult.error||!eventResult.data)notFound();
  const assigned=assignmentResult.data??[];
  if(assignmentResult.error||detailsResult.error)throw new Error('Event assignment details could not be loaded.');
  const {activity,...event}=eventResult.data;
  return <main className="workflow-page"><EventCreateForm {...options} initial={{...event,activity:Array.isArray(activity)?activity[0]??null:activity,lead_handler_id:assigned.find(a=>a.role==='lead')?.handler_id??'',member_handler_ids:assigned.filter(a=>a.role==='member').map(a=>a.handler_id),...detailsResult.data}}/></main>;
}
