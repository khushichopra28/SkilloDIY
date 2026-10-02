'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type EventSummary = {
  id: string; event_code: string; name: string; type: string; event_date: string;
  expected_arrival_time: string | null; client_name: string | null; expected_participants: number | null;
  venue: string; city: string; status: string; activity?: { name: string } | null;
  cities?: { name: string; code: string } | null;
};
type Assignment = { id: string; event_id: string; responsibility: string; status: string; events: EventSummary | null };

export default function HandlerEvents() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [term, setTerm] = useState('');
  const [range, setRange] = useState('upcoming');
  async function load() {
    setLoading(true); setError('');
    try {
      const db = createClient();
      const { data: { user }, error: userError } = await db.auth.getUser();
      if (userError || !user) throw new Error('Sign in to view your event assignments.');
      const { data, error: queryError } = await db.from('event_assignments')
        .select('id,event_id,responsibility,status,events(id,event_code,name,type,event_date,expected_arrival_time,client_name,expected_participants,venue,city,status,activity:activities(name),cities(name,code))')
        .eq('handler_id', user.id).order('assigned_at', { ascending: false }).limit(200);
      if (queryError) throw queryError;
      setRows((data ?? []) as unknown as Assignment[]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Events could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter(assignment => {
    const event = assignment.events;
    if (!event) return false;
    const upcoming = new Date(`${event.event_date}T23:59:00`).getTime() >= Date.now() && event.status !== 'completed' && event.status !== 'cancelled';
    return (range === 'upcoming' ? upcoming : !upcoming) && `${event.event_code} ${event.name} ${event.venue} ${event.city} ${event.client_name ?? ''} ${event.activity?.name ?? ''}`.toLowerCase().includes(term.toLowerCase());
  }), [rows, range, term]);

  return <main className="data-page handler-events-page">
    <header className="data-heading"><div><div className="eyebrow">MY WORK</div><h1>My events</h1><p>Your assigned event schedule and event-day workspaces.</p></div><div className="handler-filters"><button className={`button ${range === 'upcoming' ? 'button-primary' : 'button-secondary'}`} onClick={() => setRange('upcoming')}>Upcoming</button><button className={`button ${range === 'past' ? 'button-primary' : 'button-secondary'}`} onClick={() => setRange('past')}>Past events</button></div></header>
    <section className="data-panel"><div className="data-toolbar"><label className="data-search"><Search size={15}/><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Search your events"/></label></div>
      {loading ? <div className="data-state">Loading your assignments…</div> : error ? <div className="data-state data-error" role="alert">{error}<button className="button button-secondary" onClick={load}>Try again</button></div> : filtered.length === 0 ? <div className="data-state"><CalendarDays size={22}/><b>No {range === 'upcoming' ? 'upcoming' : 'past'} events</b><span>Your event lead will notify you when a new assignment is made.</span></div> : <div className="handler-event-list">{filtered.map(assignment => {
        const event = assignment.events!;
        return <Link key={assignment.id} href={`/handler/events/${event.id}`} className="handler-event-card">
          <div className="handler-event-date"><b>{datePart(event.event_date, 'day')}</b><small>{datePart(event.event_date, 'month').toUpperCase()}</small></div>
          <div className="handler-event-copy"><span className={`table-status ${event.status}`}>{event.status}</span><h2>{event.name}</h2>
            <p><MapPin size={13}/>{event.cities?.name ?? event.city} · {event.venue}</p>
            <p><CalendarDays size={13}/>{formatDate(event.event_date)} · Expected arrival {formatTime(event.expected_arrival_time)} <span>· {assignment.responsibility}</span></p>
            <small>{event.activity?.name ?? 'Activity not set'} · {event.client_name ?? 'Legacy client'}</small>
          </div><span className="handler-event-open">Open event&nbsp; →</span>
        </Link>;
      })}</div>}
    </section>
  </main>;
}

function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); }
function formatTime(value: string | null) { if (!value) return 'Not set'; const [hour, minute] = value.slice(0, 5).split(':').map(Number); return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function datePart(value: string, part: 'day' | 'month') { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', part === 'day' ? { day: '2-digit' } : { month: 'short' }); }
