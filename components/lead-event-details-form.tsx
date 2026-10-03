'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Details={event_photo_path:string|null;amount_paid:number|null;payment_method:'GPay'|'Cash'|null;payment_screenshot_path:string|null};
export function LeadEventDetailsForm({eventId,initial}:{eventId:string;initial:Details|null}){
  const [photo,setPhoto]=useState<File|null>(null),[screenshot,setScreenshot]=useState<File|null>(null),[amount,setAmount]=useState(initial?.amount_paid?.toString()??''),[method,setMethod]=useState<string>(initial?.payment_method??''),[saved,setSaved]=useState<Details|null>(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function save(){setError('');setMessage('');if(method==='GPay'&&!screenshot&&!saved?.payment_screenshot_path){setError('Upload the client GPay payment screenshot.');return}setBusy(true);const db=createClient(),uploaded:string[]=[];try{
    const {data:{user},error:userError}=await db.auth.getUser();if(userError||!user)throw new Error('Your session has expired.');const userId=user.id;
    async function upload(file:File|null,kind:string){if(!file)return null;const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=`${userId}/${eventId}/${kind}-${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from('event-lead-files').upload(path,file,{contentType:file.type});if(error)throw error;uploaded.push(path);return path}
    const photoPath=await upload(photo,'photo')??saved?.event_photo_path??null;
    const screenshotPath=method==='GPay'?(await upload(screenshot,'gpay')??saved?.payment_screenshot_path??null):null;
    const payload={event_id:eventId,event_photo_path:photoPath,amount_paid:amount===''?null:Number(amount),payment_method:(method||null) as Details['payment_method'],payment_screenshot_path:screenshotPath};
    const {error}=await db.from('event_lead_details').upsert(payload,{onConflict:'event_id'});if(error)throw error;
    setSaved(payload);setPhoto(null);setScreenshot(null);setMessage('Lead event details saved.');
  }catch(reason){if(uploaded.length)await db.storage.from('event-lead-files').remove(uploaded);setError(reason instanceof Error?reason.message:'Lead details could not be saved.')}finally{setBusy(false)}}
  return <section className="detail-panel" style={{marginTop:20}}><div className="detail-panel-heading"><div><h2>Lead event details</h2><p>Event photo and client payment record. Members do not have access.</p></div></div>
    {saved?.event_photo_path&&<small>Event photo saved.</small>}<label className="workflow-field"><span className="workflow-field-heading">Event photo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]??null)}/></label>
    <label className="workflow-field"><span className="workflow-field-heading">Amount paid</span><input type="number" min={0} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label className="workflow-field"><span className="workflow-field-heading">Payment method</span><select value={method} onChange={e=>{setMethod(e.target.value as 'GPay'|'Cash'|'');if(e.target.value==='Cash')setScreenshot(null)}}><option value="">Not recorded</option><option value="GPay">GPay</option><option value="Cash">Cash</option></select></label>
    {method==='GPay'&&<label className="workflow-field"><span className="workflow-field-heading">Client payment screenshot <i>Required</i></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setScreenshot(e.target.files?.[0]??null)}/>{saved?.payment_screenshot_path&&!screenshot&&<small>Current GPay screenshot saved.</small>}</label>}
    {error&&<div role="alert" className="workflow-error">{error}</div>}{message&&<div role="status" className="workflow-success">{message}</div>}<button className="button button-primary" disabled={busy} onClick={save}>{busy?'Saving…':'Save lead details'}</button>
  </section>
}
