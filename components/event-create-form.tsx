'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Users } from 'lucide-react';
import { saveEvent } from '@/lib/services/events';
import type { EventStatus } from '@/types/domain';
import { GoogleVenuePicker } from '@/components/google-venue-picker';
import type { VenueSelection } from '@/components/google-venue-picker';

type CityOption = { id:string; name:string };
type HandlerOption = { id:string; handler_id:string; full_name:string; email:string };
export type EventFormInitial = { id?:string; name?:string; type?:string; activity_name?:string|null; activity_id?:string|null; activity?:{name:string}|null; client_name?:string|null; description?:string|null; city_id?:string|null; event_date?:string; venue?:string; address?:string; venue_id?:string|null; latitude?:number|null; longitude?:number|null; google_place_id?:string|null; venue_record?:{id:string;name:string;address:string;latitude:number|null;longitude:number|null;google_place_id:string|null}|null; expected_arrival_time?:string|null; expected_participants?:number|null; age_group?:string|null; theme?:string|null; status?:EventStatus; lead_handler_id?:string; member_handler_ids?:string[] };

export default function EventCreateForm({ cities, handlers, initial }: { cities:CityOption[]; handlers:HandlerOption[]; initial?:EventFormInitial }) {
  const [form,setForm]=useState({name:initial?.name??'',type:initial?.type??'',activity_name:initial?.activity_name??initial?.activity?.name??'',activity_id:initial?.activity_id??'',client_name:initial?.client_name??'',description:initial?.description??'',city_id:initial?.city_id??'',date:initial?.event_date?.slice(0,10)??'',venue:initial?.venue_record?.name??initial?.venue??'',address:initial?.venue_record?.address??initial?.address??'',venue_id:initial?.venue_record?.id??initial?.venue_id??null as string|null,latitude:initial?.venue_record?.latitude??initial?.latitude??null as number|null,longitude:initial?.venue_record?.longitude??initial?.longitude??null as number|null,google_place_id:initial?.venue_record?.google_place_id??initial?.google_place_id??null as string|null,expected_arrival_time:initial?.expected_arrival_time?.slice(0,5)??'',expected_participants:initial?.expected_participants??1,age_group:initial?.age_group??'',theme:initial?.theme??'',status:initial?.status??'draft',lead_handler_id:initial?.lead_handler_id??'',member_handler_ids:initial?.member_handler_ids?.length?([...initial.member_handler_ids,...Array(Math.max(0,3-initial.member_handler_ids.length)).fill('')]):['','','']});
  const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const router=useRouter();
  const filtered=handlers.filter(h=>`${h.full_name} ${h.handler_id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  function update<K extends keyof typeof form>(key:K,value:(typeof form)[K]){setForm(current=>key==='lead_handler_id'?({...current,lead_handler_id:value as string,member_handler_ids:current.member_handler_ids.map(id=>id===value?'':id)}):({...current,[key]:value}));setError('')}
  function chooseMember(index:number,value:string){const next=[...form.member_handler_ids];next[index]=value;update('member_handler_ids',next)}
  async function submit(status:EventStatus=form.status){
    setBusy(true);setError('');
    try{
      const result=await saveEvent({...form,status,member_handler_ids:form.member_handler_ids.filter(Boolean)},initial?.id??null);
      router.push(`/admin/events/${result.id}`);router.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:'Event could not be saved.')}finally{setBusy(false)}
  }
  return <div className="workflow"><div className="workflow-top"><button className="back-link" onClick={()=>router.push(initial?.id?`/admin/events/${initial.id}`:'/admin/events')}><ArrowLeft size={14}/> Events</button></div><div className="workflow-card">
    <header><div className="eyebrow">{initial?.id?'EDIT EVENT':'NEW EVENT'}</div><h1>{initial?.id?'Edit event':'Event setup'}</h1><p>Set the event details and assign its lead and handler team.</p></header>
    <div className="form-grid">
      <Field label="Event Name" required><input value={form.name} maxLength={120} onChange={e=>update('name',e.target.value)}/></Field>
      <Field label="Event Type" required><select value={form.type} onChange={e=>update('type',e.target.value)}><option value="">Select event type</option><option>Corporate Workshop</option><option>Birthday Party</option><option>Playdate / Special Occasion</option></select></Field>
      <Field label="Activity" required><input value={form.activity_name} maxLength={160} onChange={e=>update('activity_name',e.target.value)} placeholder="Enter activity"/></Field>
      <Field label="Client Name"><input value={form.client_name} maxLength={160} onChange={e=>update('client_name',e.target.value)}/></Field>
      <Field label="Description" wide><textarea rows={3} value={form.description} maxLength={4000} onChange={e=>update('description',e.target.value)}/></Field>
      <Field label="City" required><select value={form.city_id} onChange={e=>{const city_id=e.target.value;setForm(current=>({...current,city_id,venue_id:null,venue:'',address:'',latitude:null,longitude:null,google_place_id:null}));setError('')}}><option value="">Select city</option>{cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <div className="wide"><Field label="Venue search"><GoogleVenuePicker cityName={cities.find(c=>c.id===form.city_id)?.name??''} value={{venue_id:form.venue_id,name:form.venue,address:form.address,latitude:form.latitude,longitude:form.longitude,google_place_id:form.google_place_id}} onChange={(value:VenueSelection)=>setForm(current=>({...current,...value}))}/></Field></div>
      <Field label="Venue" required><input value={form.venue} onChange={e=>setForm(current=>({...current,venue:e.target.value,venue_id:null,latitude:null,longitude:null,google_place_id:null}))} placeholder="Venue name"/></Field>
      <Field label="Full Address" wide required><textarea rows={2} value={form.address} onChange={e=>setForm(current=>({...current,address:e.target.value,venue_id:null,latitude:null,longitude:null,google_place_id:null}))}/></Field>
      <Field label="Event Date" required><input type="date" value={form.date} onChange={e=>update('date',e.target.value)}/></Field>
      <Field label="Expected Handler Arrival" required><input type="time" value={form.expected_arrival_time} onChange={e=>update('expected_arrival_time',e.target.value)}/></Field>
      <Field label="Expected Participants" required><input type="number" min={1} value={form.expected_participants} onChange={e=>update('expected_participants',Number(e.target.value))}/></Field>
      <Field label="Age Group"><input value={form.age_group} onChange={e=>update('age_group',e.target.value)}/></Field>
      <Field label="Theme"><input value={form.theme} onChange={e=>update('theme',e.target.value)}/></Field>
    </div>
    <section className="detail-panel" style={{marginTop:20}}><div className="detail-panel-heading"><div><h2><Users size={16}/> Lead and members</h2><p>Only active, approved handlers are available.</p></div></div>
      <Field label="Search handlers by name or handler ID"><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search approved handlers"/></Field>
      <Field label="Lead handler" required><select value={form.lead_handler_id} onChange={e=>update('lead_handler_id',e.target.value)}><option value="">Select lead</option>{filtered.map(h=><option key={h.id} value={h.id}>{h.full_name} · {h.handler_id}</option>)}</select></Field>
      {form.member_handler_ids.map((member,index)=><div key={index} className="assign-control"><label className="workflow-field"><span className="workflow-field-heading">Member {index+1}</span><select value={member} onChange={e=>chooseMember(index,e.target.value)}><option value="">Select member (optional)</option>{filtered.filter(h=>h.id!==form.lead_handler_id&&!form.member_handler_ids.some((other,i)=>i!==index&&other===h.id)).map(h=><option key={h.id} value={h.id}>{h.full_name} · {h.handler_id}</option>)}</select></label><button className="button button-secondary" type="button" onClick={()=>update('member_handler_ids',form.member_handler_ids.filter((_,i)=>i!==index))}>Remove slot</button></div>)}
      <button type="button" className="button button-secondary" onClick={()=>update('member_handler_ids',[...form.member_handler_ids,''])}>Add more handlers</button>
    </section>
    {error&&<div className="workflow-error" role="alert">{error}</div>}
    <footer className="workflow-actions"><button className="button button-secondary" onClick={()=>router.push('/admin/events')}>Cancel</button><span/>{initial?.id?<button disabled={busy} className="button button-primary" onClick={()=>submit()}>{busy?'Saving…':'Save changes'} <Check size={14}/></button>:<><button disabled={busy} className="button button-secondary" onClick={()=>submit('draft')}>{busy?'Saving…':'Save draft'}</button><button disabled={busy} className="button button-primary" onClick={()=>submit('upcoming')}>{busy?'Saving…':'Publish event'} <Check size={14}/></button></>}</footer>
  </div></div>;
}
function Field({label,required,wide,children}:{label:string;required?:boolean;wide?:boolean;children:React.ReactNode}){return <label className={`workflow-field ${wide?'wide':''}`}><span className="workflow-field-heading">{label}{required&&<i>Required</i>}</span>{children}</label>}
