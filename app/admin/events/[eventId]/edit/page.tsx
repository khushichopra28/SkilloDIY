import { notFound } from 'next/navigation';
import EventCreateForm from '@/components/event-create-form';
import { getEventFormOptions } from '@/lib/services/event-form-data';
import { createClient } from '@/lib/supabase/server';

export default async function EditEventPage({params}:{params:Promise<{eventId:string}>}){
  const {eventId}=await params,db=await createClient();
  const [eventResult,assignmentResult,options]=await Promise.all([
    db.from('events').select('id,name,type,activity_name,activity_id,activity:activities(name),client_name,description,city_id,event_date,venue,address,venue_id,latitude,longitude,venue_record:venues!events_venue_id_fkey(id,name,address,latitude,longitude,google_place_id),expected_arrival_time,expected_participants,age_group,theme,status').eq('id',eventId).maybeSingle(),
    db.from('event_assignments').select('handler_id,role').eq('event_id',eventId),
    getEventFormOptions(),
  ]);
  if(eventResult.error||!eventResult.data)notFound();
  const assigned=assignmentResult.data??[];
  if(assignmentResult.error)throw new Error('Event assignment details could not be loaded.');
  const {activity,venue_record,...event}=eventResult.data;
  return <main className="workflow-page"><EventCreateForm {...options} initial={{...event,activity:Array.isArray(activity)?activity[0]??null:activity,venue_record:Array.isArray(venue_record)?venue_record[0]??null:venue_record,lead_handler_id:assigned.find(a=>a.role==='lead')?.handler_id??'',member_handler_ids:assigned.filter(a=>a.role==='member').map(a=>a.handler_id)}}/></main>;
}
