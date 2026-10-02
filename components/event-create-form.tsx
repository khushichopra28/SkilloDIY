'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, Check, MapPin, Users } from 'lucide-react';
import { createEvent, getWorkspaceContext } from '@/lib/services/events';
import type { City, EventDraft } from '@/types/domain';

const steps = ['Event basics', 'Place & schedule', 'Review'];
const blank: EventDraft = {
  name: '', type: '', activity_id: '', client_name: '', description: '', city_id: '', date: '',
  venue: '', address: '', expected_arrival_time: '', expected_participants: null, age_group: '', theme: '', status: 'draft',
};
type FieldName = keyof EventDraft;
type Activity = { id: string; name: string };

export default function EventCreateForm() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<EventDraft>(blank);
  const [cities, setCities] = useState<City[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    getWorkspaceContext()
      .then(context => {
        if (!mounted) return;
        setCities(context.cities);
        setActivities(context.activities as Activity[]);
      })
      .catch(reason => {
        if (mounted) setLoadError(reason instanceof Error ? reason.message : 'Event setup data could not be loaded.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filteredActivities = useMemo(() => {
    const query = activitySearch.trim().toLocaleLowerCase();
    return query ? activities.filter(activity => activity.name.toLocaleLowerCase().includes(query)) : activities;
  }, [activities, activitySearch]);

  function update<K extends FieldName>(key: K, value: EventDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setError('');
  }

  function validateStep(currentStep: number) {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (currentStep === 0) {
      if (draft.name.trim().length < 3) nextErrors.name = 'Please enter an event name (at least 3 characters).';
      if (!draft.type) nextErrors.type = 'Please select an event type.';
      if (!draft.activity_id || !activities.some(activity => activity.id === draft.activity_id)) nextErrors.activity_id = 'Please select an activity.';
      if (!draft.client_name.trim()) nextErrors.client_name = 'Please enter the client name.';
    }
    if (currentStep === 1) {
      if (!draft.city_id || !cities.some(city => city.id === draft.city_id)) nextErrors.city_id = 'Please select a city.';
      if (draft.venue.trim().length < 2) nextErrors.venue = 'Please enter the venue name.';
      if (draft.address.trim().length < 5) nextErrors.address = 'Please enter the full address.';
      if (!draft.date) nextErrors.date = 'Please select the event date.';
      if (draft.expected_participants === null || !Number.isInteger(draft.expected_participants) || draft.expected_participants < 1) nextErrors.expected_participants = 'Enter a positive whole number of participants.';
      if (!draft.expected_arrival_time) nextErrors.expected_arrival_time = 'Please enter the expected handler arrival time.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function next() {
    setError('');
    if (!validateStep(step)) return;
    setStep(value => Math.min(value + 1, 2));
  }

  async function save(status: 'draft' | 'upcoming') {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const result = await createEvent({ ...draft, status });
      setDone(`${result.event_code} · ${result.name} saved`);
      setTimeout(() => router.push('/admin/events'), 900);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Event could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="workflow"><div className="workflow-skeleton" aria-label="Loading event setup"/></div>;
  if (loadError) return <div className="workflow"><div className="workflow-card"><header><div className="eyebrow">NEW EVENT</div><h1>Event setup could not be loaded</h1><p>We could not load your organization’s city and activity lists.</p></header><div className="workflow-error" role="alert">{loadError}</div><footer className="workflow-actions"><button className="button button-secondary" onClick={() => router.push('/admin/events')}><ArrowLeft size={14}/> Events</button></footer></div></div>;

  return <div className="workflow">
    <div className="workflow-top">
      <button className="back-link" onClick={() => router.push('/admin/events')}><ArrowLeft size={14}/> Events</button>
      <div className="workflow-steps">{steps.map((title, index) => <div className={`workflow-step ${index === step ? 'current' : index < step ? 'finished' : ''}`} key={title}><span>{index < step ? <Check size={13}/> : index + 1}</span>{title}</div>)}</div>
    </div>
    <div className="workflow-card">
      <header><div className="eyebrow">NEW EVENT · STEP {step + 1} OF 3</div><h1>{step === 0 ? 'Event basics' : step === 1 ? 'Place & schedule' : 'Review'}</h1><p>{step === 0 ? 'Add the event, activity and client details.' : step === 1 ? 'Choose an organization city and enter the handler arrival plan.' : 'Confirm the details before saving or publishing.'}</p></header>

      {step === 0 && <div className="form-grid">
        <Field label="Event Name" required error={errors.name}><input id="event-name" autoFocus maxLength={120} value={draft.name} onChange={event => update('name', event.target.value)} placeholder="Enter event name" aria-invalid={!!errors.name}/></Field>
        <Field label="Event Type" required error={errors.type}><select id="event-type" value={draft.type} onChange={event => update('type', event.target.value)} aria-invalid={!!errors.type}><option value="">Select event type</option><option>Corporate Workshop</option><option>Birthday Party</option><option>Playdate / Special Occasion</option></select></Field>
        <Field label="Activity" required error={errors.activity_id} wide={activities.length > 8}>
          {activities.length > 8 && <input aria-label="Search activities" type="search" className="activity-search" value={activitySearch} onChange={event => setActivitySearch(event.target.value)} placeholder="Search configured activities"/>}
          <select id="event-activity" required value={draft.activity_id} onChange={event => update('activity_id', event.target.value)} aria-invalid={!!errors.activity_id}>
            <option value="">{activities.length ? 'Select activity' : 'No activities configured'}</option>
            {filteredActivities.map(activity => <option value={activity.id} key={activity.id}>{activity.name}</option>)}
          </select>
          {!activities.length && <small className="field-help">Add the official Skill-O activity names to this organization’s Activities list. No sample activity names are being substituted.</small>}
          {activities.length > 8 && !filteredActivities.length && <small className="field-help">No activities match your search.</small>}
        </Field>
        <Field label="Client Name" required error={errors.client_name}><input id="client-name" maxLength={160} value={draft.client_name} onChange={event => update('client_name', event.target.value)} placeholder="Enter client or organization name" aria-invalid={!!errors.client_name}/></Field>
        <Field label="Event Description" wide><textarea id="event-description" rows={3} maxLength={4000} value={draft.description} onChange={event => update('description', event.target.value)} placeholder="Purpose, key details or special considerations"/></Field>
      </div>}

      {step === 1 && <div className="form-grid">
        <Field label="City" required error={errors.city_id}>
          <select id="event-city" required value={draft.city_id} onChange={event => update('city_id', event.target.value)} disabled={!cities.length} aria-invalid={!!errors.city_id}>
            <option value="">{cities.length ? 'Select city' : 'No active cities configured'}</option>
            {cities.map((city: City) => <option value={city.id} key={city.id}>{city.name}</option>)}
          </select>
          {!cities.length && <small className="field-help">No active cities are available to your account. Ask an administrator to configure a city and confirm its access.</small>}
        </Field>
        <Field label="Venue Name" required error={errors.venue}><input id="event-venue" maxLength={160} value={draft.venue} onChange={event => update('venue', event.target.value)} placeholder="Enter venue name" aria-invalid={!!errors.venue}/></Field>
        <Field label="Full Address" required wide error={errors.address}><textarea id="event-address" rows={3} maxLength={500} value={draft.address} onChange={event => update('address', event.target.value)} placeholder="Street, district and postal code" aria-invalid={!!errors.address}/></Field>
        <Field label="Event Date" required error={errors.date}><input id="event-date" type="date" value={draft.date} onChange={event => update('date', event.target.value)} aria-invalid={!!errors.date}/></Field>
        <Field label="Expected Participants" required error={errors.expected_participants}><input id="event-participants" type="number" min={1} step={1} inputMode="numeric" value={draft.expected_participants ?? ''} onChange={event => update('expected_participants', event.target.value === '' ? null : Number(event.target.value))} aria-invalid={!!errors.expected_participants}/></Field>
        <Field label="Expected Handler Arrival" required error={errors.expected_arrival_time}><input id="expected-arrival" type="time" value={draft.expected_arrival_time} onChange={event => update('expected_arrival_time', event.target.value)} aria-invalid={!!errors.expected_arrival_time}/></Field>
        <Field label="Age Group"><input id="event-age-group" maxLength={80} value={draft.age_group} onChange={event => update('age_group', event.target.value)} placeholder="e.g. 8–15 years"/></Field>
        <Field label="Theme"><input id="event-theme" maxLength={160} value={draft.theme} onChange={event => update('theme', event.target.value)} placeholder="e.g. Christmas Crafts"/></Field>
      </div>}

      {step === 2 && <div className="review-summary">
        <Summary icon={<CalendarDays size={16}/>} label="Event Name" value={draft.name}/>
        <Summary label="Event Type" value={draft.type}/>
        <Summary label="Activity" value={activities.find(activity => activity.id === draft.activity_id)?.name ?? 'Not selected'}/>
        <Summary label="Client Name" value={draft.client_name}/>
        <Summary label="Description" value={draft.description || '—'}/>
        <Summary icon={<MapPin size={16}/>} label="City" value={cities.find(city => city.id === draft.city_id)?.name ?? 'Not selected'}/>
        <Summary label="Venue" value={draft.venue}/>
        <Summary label="Address" value={draft.address}/>
        <Summary icon={<CalendarDays size={16}/>} label="Event Date" value={formatDate(draft.date)}/>
        <Summary label="Expected Handler Arrival" value={formatTime(draft.expected_arrival_time)}/>
        <Summary icon={<Users size={16}/>} label="Expected Participants" value={draft.expected_participants?.toLocaleString('en-IN') ?? 'Not entered'}/>
        <Summary label="Age Group" value={draft.age_group || '—'}/>
        <Summary label="Theme" value={draft.theme || '—'}/>
        <p className="workflow-note">Event and handler IDs are assigned by the database. Assign handlers and add reimbursement rules from the saved event workspace.</p>
      </div>}

      {error && <div role="alert" className="workflow-error">{error}</div>}
      {done && <div role="status" className="workflow-success">{done}</div>}
      <footer className="workflow-actions">
        <button type="button" className="button button-secondary" onClick={() => step ? setStep(step - 1) : router.push('/admin/events')}>{step ? 'Back' : 'Cancel'}</button><span/>
        {step < 2 ? <button type="button" className="button button-primary" onClick={next}>Continue <ArrowRight size={14}/></button> : <><button type="button" disabled={busy} className="button button-secondary" onClick={() => save('draft')}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" disabled={busy} className="button button-primary" onClick={() => save('upcoming')}>{busy ? 'Publishing…' : 'Publish event'} <Check size={14}/></button></>}
      </footer>
    </div>
  </div>;
}

function Field({ label, required, wide, error, children }: { label: string; required?: boolean; wide?: boolean; error?: string; children: React.ReactNode }) {
  return <label className={`workflow-field ${wide ? 'wide' : ''}`}>
    <span className="workflow-field-heading">{label}{required && <i>Required</i>}</span>
    {children}
    {error && <small className="field-error" role="alert">{error}</small>}
  </label>;
}

function Summary({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return <div className="summary-row">{icon && <span className="summary-icon">{icon}</span>}<div><small>{label}</small><b>{value}</b></div></div>;
}

function formatDate(value: string) {
  if (!value) return 'Not selected';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(value: string) {
  if (!value) return 'Not selected';
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
