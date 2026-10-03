'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Users } from 'lucide-react';
import { saveEvent } from '@/lib/services/events';
import type { EventStatus } from '@/types/domain';

type CityOption = { id:string; name:string };
type HandlerOption = { id:string; handler_id:string; full_name:string; email:string };
export type EventFormInitial = { id?:string; name?:string; type?:string; activity_name?:string|null; activity_id?:string|null; activity?:{name:string}|null; client_name?:string|null; description?:string|null; city_id?:string|null; event_date?:string; venue?:string; address?:string; expected_arrival_time?:string|null; expected_participants?:number|null; age_group?:string|null; theme?:string|null; status?:EventStatus; lead_handler_id?:string; member_handler_ids?:string[]; event_photo_path?:string|null; amount_paid?:number|null; payment_method?:'GPay'|'Cash'|null; payment_screenshot_path?:string|null };

export default function EventCreateForm({ cities, handlers, initial }: { cities:CityOption[]; handlers:HandlerOption[]; initial?:EventFormInitial }) {
  const [form,setForm]=useState({name:initial?.name??'',type:initial?.type??'',activity_name:initial?.activity_name??initial?.activity?.name??'',activity_id:initial?.activity_id??'',client_name:initial?.client_name??'',description:initial?.description??'',city_id:initial?.city_id??'',date:initial?.event_date?.slice(0,10)??'',venue:initial?.venue??'',address:initial?.address??'',expected_arrival_time:initial?.expected_arrival_time?.slice(0,5)??'',expected_participants:initial?.expected_participants??1,age_group:initial?.age_group??'',theme:initial?.theme??'',status:initial?.status??'draft',lead_handler_id:initial?.lead_handler_id??'',member_handler_ids:initial?.member_handler_ids?.length?([...initial.member_handler_ids,...Array(Math.max(0,3-initial.member_handler_ids.length)).fill('')]):['','',''],event_photo_path:initial?.event_photo_path??null,amount_paid:initial?.amount_paid?.toString()??'',payment_method:initial?.payment_method??'',payment_screenshot_path:initial?.payment_screenshot_path??null});
  const [photo,setPhoto]=useState<File|null>(null),[screenshot,setScreenshot]=useState<File|null>(null),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const router=useRouter();
  const filtered=handlers.filter(h=>`${h.full_name} ${h.handler_id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  function update<K extends keyof typeof form>(key:K,value:(typeof form)[K]){setForm(current=>key==='lead_handler_id'?({...current,lead_handler_id:value as string,member_handler_ids:current.member_handler_ids.map(id=>id===value?'':id)}):({...current,[key]:value}));setError('')}
  function chooseMember(index:number,value:string){const next=[...form.member_handler_ids];next[index]=value;update('member_handler_ids',next)}
  async function submit(status:EventStatus=form.status){
    setBusy(true);setError('');
    try{
      const result=await saveEvent({...form,status,member_handler_ids:form.member_handler_ids.filter(Boolean),amount_paid:form.amount_paid||null,payment_method:form.payment_method||null},initial?.id??null,{eventPhoto:photo,screenshot});
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
      <Field label="City" required><select value={form.city_id} onChange={e=>update('city_id',e.target.value)}><option value="">Select city</option>{cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Venue" required><input value={form.venue} onChange={e=>update('venue',e.target.value)}/></Field>
      <Field label="Full Address" wide required><textarea rows={2} value={form.address} onChange={e=>update('address',e.target.value)}/></Field>
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
    <section className="detail-panel" style={{marginTop:20}}><div className="detail-panel-heading"><div><h2>Lead event details</h2><p>Visible to event managers and the assigned lead only.</p></div></div>
      {form.event_photo_path&&<small>Current event photo attached.</small>}<Field label="Event photo"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]??null)}/></Field>
      <Field label="Amount paid"><input type="number" min={0} step="0.01" value={form.amount_paid} onChange={e=>update('amount_paid',e.target.value)}/></Field>
      <Field label="Payment method"><select value={form.payment_method} onChange={e=>{update('payment_method',e.target.value as 'GPay'|'Cash'|'');if(e.target.value==='Cash')setScreenshot(null)}}><option value="">Not recorded</option><option value="GPay">GPay</option><option value="Cash">Cash</option></select></Field>
      {form.payment_method==='GPay'&&<>{form.payment_screenshot_path&&!screenshot&&<small>Current GPay screenshot attached.</small>}<Field label="Client payment screenshot" required><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setScreenshot(e.target.files?.[0]??null)}/></Field></>}
    </section>
    {error&&<div className="workflow-error" role="alert">{error}</div>}
    <footer className="workflow-actions"><button className="button button-secondary" onClick={()=>router.push('/admin/events')}>Cancel</button><span/>{initial?.id?<button disabled={busy} className="button button-primary" onClick={()=>submit()}>{busy?'Saving…':'Save changes'} <Check size={14}/></button>:<><button disabled={busy} className="button button-secondary" onClick={()=>submit('draft')}>{busy?'Saving…':'Save draft'}</button><button disabled={busy} className="button button-primary" onClick={()=>submit('upcoming')}>{busy?'Saving…':'Publish event'} <Check size={14}/></button></>}</footer>
  </div></div>;
}
function Field({label,required,wide,children}:{label:string;required?:boolean;wide?:boolean;children:React.ReactNode}){return <label className={`workflow-field ${wide?'wide':''}`}><span className="workflow-field-heading">{label}{required&&<i>Required</i>}</span>{children}</label>}
