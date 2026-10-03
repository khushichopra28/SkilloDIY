'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Search } from 'lucide-react';

type EventSummary = {
  id: string; event_code: string; name: string; type: string; event_date: string;
  expected_arrival_time: string | null; client_name: string | null; expected_participants: number | null;
  venue: string; city: string; status: string; activity_name?:string|null; activity?: { name: string } | null;
  cities?: { name: string; code: string } | null;
};
type Assignment = { id: string; event_id: string; responsibility: string; status: string; events: EventSummary | null };

export default function HandlerEvents({initialRows}:{initialRows:Assignment[]}) {
  const [rows] = useState<Assignment[]>(initialRows);
  const [term, setTerm] = useState('');
  const [range, setRange] = useState('upcoming');
  const filtered = useMemo(() => rows.filter(assignment => {
    const event = assignment.events;
    if (!event) return false;
    const upcoming = new Date(`${event.event_date}T23:59:00`).getTime() >= Date.now() && event.status !== 'completed' && event.status !== 'cancelled';
    return (range === 'upcoming' ? upcoming : !upcoming) && `${event.event_code} ${event.name} ${event.venue} ${event.city} ${event.client_name ?? ''} ${event.activity_name ?? event.activity?.name ?? ''}`.toLowerCase().includes(term.toLowerCase());
  }), [rows, range, term]);

  return <main className="data-page handler-events-page">
    <header className="data-heading"><div><div className="eyebrow">MY WORK</div><h1>My events</h1><p>Your assigned event schedule and event-day workspaces.</p></div><div className="handler-filters"><button className={`button ${range === 'upcoming' ? 'button-primary' : 'button-secondary'}`} onClick={() => setRange('upcoming')}>Upcoming</button><button className={`button ${range === 'past' ? 'button-primary' : 'button-secondary'}`} onClick={() => setRange('past')}>Past events</button></div></header>
    <section className="data-panel"><div className="data-toolbar"><label className="data-search"><Search size={15}/><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Search your events"/></label></div>
      {filtered.length === 0 ? <div className="data-state"><CalendarDays size={22}/><b>No {range === 'upcoming' ? 'upcoming' : 'past'} events</b><span>Your event lead will notify you when a new assignment is made.</span></div> : <div className="handler-event-list">{filtered.map(assignment => {
        const event = assignment.events!;
        return <Link key={assignment.id} href={`/handler/events/${event.id}`} className="handler-event-card">
          <div className="handler-event-date"><b>{datePart(event.event_date, 'day')}</b><small>{datePart(event.event_date, 'month').toUpperCase()}</small></div>
          <div className="handler-event-copy"><span className={`table-status ${event.status}`}>{event.status}</span><h2>{event.name}</h2>
            <p><MapPin size={13}/>{event.cities?.name ?? event.city} · {event.venue}</p>
            <p><CalendarDays size={13}/>{formatDate(event.event_date)} · Expected arrival {formatTime(event.expected_arrival_time)} <span>· {assignment.responsibility}</span></p>
            <small>{event.activity_name ?? event.activity?.name ?? 'Activity not set'} · {event.client_name ?? 'Legacy client'}</small>
          </div><span className="handler-event-open">Open event&nbsp; →</span>
        </Link>;
      })}</div>}
    </section>
  </main>;
}

function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); }
function formatTime(value: string | null) { if (!value) return 'Not set'; const [hour, minute] = value.slice(0, 5).split(':').map(Number); return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function datePart(value: string, part: 'day' | 'month') { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', part === 'day' ? { day: '2-digit' } : { month: 'short' }); }
