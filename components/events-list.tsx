'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Search } from 'lucide-react';
import type { EventRecord, EventStatus } from '@/types/domain';

const statuses: EventStatus[] = ['draft', 'upcoming', 'active', 'completed', 'cancelled', 'archived'];

export default function EventsList({initialEvents}:{initialEvents:EventRecord[]}) {
  const [events] = useState<EventRecord[]>(initialEvents);
  const [term, setTerm] = useState('');
  const [city, setCity] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const cities = Array.from(new Map(events.map(event => [event.city_id, { id: event.city_id, name: event.cities?.name ?? event.city }])).values());
  const filtered = useMemo(() => events.filter(event =>
    (city === 'all' || event.city_id === city) &&
    (status === 'all' || event.status === status) &&
    `${event.event_code} ${event.name} ${event.city} ${event.venue} ${event.client_name ?? ''} ${event.activity_name ?? event.activity?.name ?? ''}`.toLowerCase().includes(term.toLowerCase())
  ), [events, city, status, term]);
  const pageSize = 10, pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return <main className="data-page">
    <header className="data-heading"><div><div className="eyebrow">EVENT OPERATIONS</div><h1>Events</h1><p>Plan and follow events across your available cities.</p></div><Link className="button button-primary" href="/admin/events/new"><Plus size={15}/> Create event</Link></header>
    <section className="data-panel">
      <div className="data-toolbar"><label className="data-search"><Search size={15}/><input value={term} onChange={event => { setTerm(event.target.value); setPage(0); }} placeholder="Search event, client, activity or venue"/></label><select aria-label="Filter by city" value={city} onChange={event => { setCity(event.target.value); setPage(0); }}><option value="all">All available cities</option>{cities.map(item => <option value={item.id ?? ''} key={item.id}>{item.name}</option>)}</select><select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="all">All statuses</option>{statuses.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select></div>
      {rows.length === 0 ? <div className="data-state"><CalendarDays size={22}/><b>No events found</b><span>Change the filters or create a new event.</span><Link className="button button-secondary" href="/admin/events/new">Create event</Link></div> : <>
        <div className="table-scroll"><table className="events-table"><thead><tr><th>EVENT</th><th>CITY</th><th>VENUE</th><th>EVENT DATE</th><th>HANDLERS</th><th>STATUS</th><th/></tr></thead><tbody>{rows.map(event => <tr key={event.id}>
          <td><Link href={`/admin/events/${event.id}`} className="table-event-name">{event.name}</Link><small>{event.event_code} · {event.type}</small><small>{event.activity_name ?? event.activity?.name ?? 'Activity not set'} · {event.client_name ?? 'Legacy client'}</small></td>
          <td><span className="table-location"><MapPin size={13}/>{event.cities?.name ?? event.city}</span></td><td>{event.venue}</td>
          <td>{formatDate(event.event_date)}<small>Expected handler arrival · {formatTime(event.expected_arrival_time)}</small></td>
          <td>{event.required_handlers}</td><td><span className={`table-status ${event.status}`}>{event.status.replace('_', ' ')}</span></td><td><Link className="link-small" href={`/admin/events/${event.id}`}>Open</Link></td>
        </tr>)}</tbody></table></div>
        <footer className="data-pagination"><span>{filtered.length ? `${page * pageSize + 1}–${Math.min(filtered.length, (page + 1) * pageSize)} of ${filtered.length} events` : '0 events'}</span><div><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={15}/></button><span>{page + 1} / {pageCount}</span><button aria-label="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}><ChevronRight size={15}/></button></div></footer>
      </>}
    </section>
  </main>;
}

function formatDate(value: string) { return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function formatTime(value: string | null) {
  if (!value) return 'Not set';
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
