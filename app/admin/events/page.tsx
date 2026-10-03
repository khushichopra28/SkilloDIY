import EventsList from '@/components/events-list';
import {createClient} from '@/lib/supabase/server';
export default async function EventsPage(){const db=await createClient();const {data,error}=await db.from('events').select('id,event_code,name,type,activity_id,activity_name,activity:activities(name),client_name,event_date,expected_arrival_time,venue,address,city,city_id,status,required_handlers,cities(name,code)').order('event_date',{ascending:true}).limit(500);if(error)throw new Error('Events could not be loaded.');return <EventsList initialEvents={(data??[]) as any}/>}
