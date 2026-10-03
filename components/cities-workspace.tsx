'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wallet,
  X,
  Activity,
  AlertCircle,
  BriefcaseBusiness,
  UserCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface CanonicalCity {
  key: string;
  name: string;
  code: string;
  state: string;
  landmark: string;
  tagline: string;
  aliases: string[];
  theme: {
    bg: string;
    border: string;
    accent: string;
    pillBg: string;
    pillText: string;
    glow: string;
  };
}

export const CANONICAL_CITIES: CanonicalCity[] = [
  {
    key: 'mumbai',
    name: 'Mumbai',
    code: 'MUM',
    state: 'Maharashtra',
    landmark: 'Gateway of India & Marine Drive',
    tagline: 'West Region Hub · Headquarters',
    aliases: ['mumbai', 'mum', 'bombay'],
    theme: {
      bg: 'linear-gradient(145deg, #fff2f5 0%, #fff8f9 100%)',
      border: '#fbcfe8',
      accent: '#db2777',
      pillBg: '#fce7f3',
      pillText: '#9d174d',
      glow: 'rgba(219, 39, 119, 0.14)',
    },
  },
  {
    key: 'hyderabad',
    name: 'Hyderabad',
    code: 'HYD',
    state: 'Telangana',
    landmark: 'Charminar & HITEC City',
    tagline: 'South Central Hub · Tech Corridor',
    aliases: ['hyderabad', 'hyd'],
    theme: {
      bg: 'linear-gradient(145deg, #f5f0ff 0%, #fbf9ff 100%)',
      border: '#e9d5ff',
      accent: '#7e22ce',
      pillBg: '#f3e8ff',
      pillText: '#581c87',
      glow: 'rgba(126, 34, 206, 0.14)',
    },
  },
  {
    key: 'bengaluru',
    name: 'Bengaluru',
    code: 'BLR',
    state: 'Karnataka',
    landmark: 'Vidhana Soudha & Garden City',
    tagline: 'South Innovation Hub · Creative Labs',
    aliases: ['bengaluru', 'bangalore', 'blr'],
    theme: {
      bg: 'linear-gradient(145deg, #edfbf7 0%, #f7fdfb 100%)',
      border: '#a7f3d0',
      accent: '#059669',
      pillBg: '#d1fae5',
      pillText: '#065f46',
      glow: 'rgba(5, 150, 105, 0.14)',
    },
  },
  {
    key: 'chennai',
    name: 'Chennai',
    code: 'CHN',
    state: 'Tamil Nadu',
    landmark: 'Central Station & Marina Coast',
    tagline: 'Coromandel Operations & Craft Studio',
    aliases: ['chennai', 'chn', 'madras'],
    theme: {
      bg: 'linear-gradient(145deg, #eff6ff 0%, #f8faff 100%)',
      border: '#bfdbfe',
      accent: '#2563eb',
      pillBg: '#dbeafe',
      pillText: '#1e40af',
      glow: 'rgba(37, 99, 235, 0.14)',
    },
  },
  {
    key: 'ahmedabad',
    name: 'Ahmedabad',
    code: 'AMD',
    state: 'Gujarat',
    landmark: 'Sabarmati & Heritage Jali',
    tagline: 'West Craft Collective & Workshops',
    aliases: ['ahmedabad', 'amd'],
    theme: {
      bg: 'linear-gradient(145deg, #fefce8 0%, #fffef4 100%)',
      border: '#fde047',
      accent: '#d97706',
      pillBg: '#fef08a',
      pillText: '#854d0e',
      glow: 'rgba(217, 119, 6, 0.14)',
    },
  },
  {
    key: 'pune',
    name: 'Pune',
    code: 'PUN',
    state: 'Maharashtra',
    landmark: 'Shaniwar Wada & Deccan Foothills',
    tagline: 'Deccan Operations & Campus Teams',
    aliases: ['pune', 'pun'],
    theme: {
      bg: 'linear-gradient(145deg, #fff7ed 0%, #fffcf8 100%)',
      border: '#fed7aa',
      accent: '#ea580c',
      pillBg: '#ffedd5',
      pillText: '#9a3412',
      glow: 'rgba(234, 88, 12, 0.14)',
    },
  },
  {
    key: 'coimbatore',
    name: 'Coimbatore',
    code: 'CBE',
    state: 'Tamil Nadu',
    landmark: 'Western Ghats & Textile Craft Hub',
    tagline: 'Kongu Region Logistics Base',
    aliases: ['coimbatore', 'cbe'],
    theme: {
      bg: 'linear-gradient(145deg, #f0fdf4 0%, #f8fdf9 100%)',
      border: '#bbf7d0',
      accent: '#16a34a',
      pillBg: '#dcfce7',
      pillText: '#14532d',
      glow: 'rgba(22, 163, 74, 0.14)',
    },
  },
  {
    key: 'kolkata',
    name: 'Kolkata',
    code: 'CCU',
    state: 'West Bengal',
    landmark: 'Howrah Bridge & Victoria Memorial',
    tagline: 'East Cultural Hub & Festival Guild',
    aliases: ['kolkata', 'ccu', 'calcutta', 'kol'],
    theme: {
      bg: 'linear-gradient(145deg, #f0f4ff 0%, #f8f9ff 100%)',
      border: '#c7d2fe',
      accent: '#4f46e5',
      pillBg: '#e0e7ff',
      pillText: '#3730a3',
      glow: 'rgba(79, 70, 229, 0.14)',
    },
  },
];

export function CityIllustration({ code, accent }: { code: string; accent: string }) {
  const c = code.toUpperCase();
  switch (c) {
    case 'MUM':
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M40 78H120" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M48 78V48H60V78M100 78V48H112V78" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="2" />
          <path d="M60 78V52C60 41 100 41 100 52V78" fill="#ffffff" fillOpacity="0.8" stroke={accent} strokeWidth="2.2" />
          <path d="M68 78V58C68 51 92 51 92 58V78" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="1.8" />
          <path d="M50 48H110L104 42H56L50 48Z" fill={accent} fillOpacity="0.3" stroke={accent} strokeWidth="1.8" />
          <path d="M72 42C72 34 88 34 88 42H72Z" fill={accent} fillOpacity="0.4" stroke={accent} strokeWidth="1.8" />
          <path d="M80 34V28" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="80" cy="26" r="2" fill={accent} />
          <path d="M30 84C42 82 50 86 64 84C78 82 86 86 100 84C114 82 122 86 130 84" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.45" />
        </svg>
      );
    case 'HYD':
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M42 78H118" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M46 78V30M54 78V30M106 78V30M114 78V30" stroke={accent} strokeWidth="2" />
          <rect x="44" y="28" width="12" height="6" rx="2" fill={accent} fillOpacity="0.4" stroke={accent} strokeWidth="1.5" />
          <rect x="104" y="28" width="12" height="6" rx="2" fill={accent} fillOpacity="0.4" stroke={accent} strokeWidth="1.5" />
          <path d="M50 28V20L53 24L50 28Z" fill={accent} />
          <path d="M110 28V20L113 24L110 28Z" fill={accent} />
          <rect x="54" y="44" width="52" height="34" fill={accent} fillOpacity="0.14" stroke={accent} strokeWidth="2" />
          <path d="M62 78V56C62 48 98 48 98 56V78" fill="#ffffff" stroke={accent} strokeWidth="2" />
          <rect x="54" y="38" width="52" height="6" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="1.5" />
          <circle cx="70" cy="41" r="1.5" fill={accent} />
          <circle cx="80" cy="41" r="1.5" fill={accent} />
          <circle cx="90" cy="41" r="1.5" fill={accent} />
        </svg>
      );
    case 'BLR':
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M38 78H122" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="46" y="52" width="68" height="26" fill={accent} fillOpacity="0.15" stroke={accent} strokeWidth="2" />
          <path d="M54 78V54M64 78V54M74 78V54M86 78V54M96 78V54M106 78V54" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" />
          <polygon points="42,52 80,36 118,52" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="2" />
          <path d="M70 36C70 24 90 24 90 36H70Z" fill={accent} fillOpacity="0.4" stroke={accent} strokeWidth="1.8" />
          <path d="M80 24V18" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="80" cy="16" r="2" fill={accent} />
          <path d="M32 78C32 68 40 68 40 78" stroke={accent} strokeWidth="1.5" fill={accent} fillOpacity="0.2" />
          <path d="M120 78C120 68 128 68 128 78" stroke={accent} strokeWidth="1.5" fill={accent} fillOpacity="0.2" />
        </svg>
      );
    case 'CHN':
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M38 78H122" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="46" y="52" width="68" height="26" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="2" />
          <rect x="70" y="28" width="20" height="50" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="2" />
          <polygon points="68,28 80,16 92,28" fill={accent} fillOpacity="0.45" stroke={accent} strokeWidth="1.8" />
          <circle cx="80" cy="38" r="4" fill="#ffffff" stroke={accent} strokeWidth="1.5" />
          <path d="M80 36V38H82" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M54 62H62M98 62H106" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <path d="M28 84C42 81 54 85 70 82C86 79 98 85 114 82C128 80 134 84 140 83" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
      );
    case 'AMD':
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M38 78H122" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M48 78V48C48 30 112 30 112 48V78" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2.2" />
          <path d="M80 78V36M80 54C68 46 64 56 64 62M80 50C92 42 96 52 96 58M80 64C70 60 68 68 68 72M80 62C90 58 92 66 92 70" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
          <rect x="42" y="74" width="76" height="5" fill={accent} fillOpacity="0.3" rx="1" />
        </svg>
      );
    case 'PUN':
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M32 58L55 42L78 54L105 38L130 58" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
          <path d="M40 78H120" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M48 78V44H112V78" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="2" />
          <path d="M44 44H116" stroke={accent} strokeWidth="2" />
          <path d="M48 40V44M60 40V44M72 40V44M88 40V44M100 40V44M112 40V44" stroke={accent} strokeWidth="2" />
          <path d="M68 78V56C68 48 92 48 92 56V78" fill="#ffffff" stroke={accent} strokeWidth="2" />
          <line x1="80" y1="50" x2="80" y2="78" stroke={accent} strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      );
    case 'CBE':
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M30 78L52 38L74 62L96 32L120 64L132 78" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M38 78H122" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="72" y="60" width="16" height="18" fill={accent} fillOpacity="0.3" stroke={accent} strokeWidth="1.8" />
          <polygon points="68,60 80,48 92,60" fill={accent} fillOpacity="0.45" stroke={accent} strokeWidth="1.8" />
          <circle cx="80" cy="45" r="2" fill={accent} />
          <circle cx="44" cy="74" r="4" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="1.2" />
          <circle cx="116" cy="74" r="4" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="1.2" />
        </svg>
      );
    case 'CCU':
    default:
      return (
        <svg viewBox="0 0 160 100" fill="none" className="city-svg-art" aria-hidden="true">
          <circle cx="80" cy="50" r="42" fill={accent} fillOpacity="0.08" />
          <path d="M36 78H124" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M48 78L54 36H58L64 78" stroke={accent} strokeWidth="2" fill={accent} fillOpacity="0.2" />
          <path d="M96 78L102 36H106L112 78" stroke={accent} strokeWidth="2" fill={accent} fillOpacity="0.2" />
          <path d="M54 36L80 48L106 36" stroke={accent} strokeWidth="2" fill="none" />
          <path d="M40 70L80 56L120 70" stroke={accent} strokeWidth="2" strokeDasharray="3 2" fill="none" />
          <line x1="68" y1="42" x2="68" y2="78" stroke={accent} strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="92" y1="42" x2="92" y2="78" stroke={accent} strokeWidth="1.2" strokeOpacity="0.6" />
          <path d="M30 84C44 82 54 86 68 84C82 82 92 86 106 84C120 82 128 86 134 84" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
      );
  }
}

interface CityStats {
  upcoming: number;
  active: number;
  completed: number;
  handlers: number;
  checkedToday: number;
  pendingExpenseSum: number;
  venues: number;
}

export function CitiesWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dbCities, setDbCities] = useState<any[]>([]);
  const [cityStatsMap, setCityStatsMap] = useState<Record<string, CityStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-CA');
  const monthStart = `${today.slice(0, 7)}-01`;

  async function loadData() {
    setLoading(true);
    setError('');
    const supabase = createClient();
    try {
      const { data: citiesData, error: citiesErr } = await supabase
        .from('cities')
        .select('id,name,code,active,inventory_base,reimbursement_rules,local_contacts,city_admin_id')
        .order('name');

      if (citiesErr) throw citiesErr;
      const list = citiesData ?? [];
      setDbCities(list);

      const statsEntries = await Promise.all(
        list.map(async city => {
          const [upcoming, active, completed, handlers, checked, expense, venues] = await Promise.all([
            supabase.from('events').select('id', { count: 'exact', head: true }).eq('city_id', city.id).eq('status', 'upcoming'),
            supabase.from('events').select('id', { count: 'exact', head: true }).eq('city_id', city.id).eq('status', 'active'),
            supabase.from('events').select('id', { count: 'exact', head: true }).eq('city_id', city.id).eq('status', 'completed').gte('event_date', monthStart),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'handler').eq('home_city_id', city.id).eq('status', 'active'),
            supabase.from('attendance').select('id,events!inner(city_id,event_date)', { count: 'exact', head: true }).eq('events.city_id', city.id).eq('events.event_date', today).not('check_in_at', 'is', null),
            supabase.from('expenses').select('amount,events!inner(city_id)').eq('events.city_id', city.id).in('status', ['submitted', 'under_review']),
            supabase.from('venues').select('id', { count: 'exact', head: true }).eq('city_id', city.id),
          ]);

          const pendingSum = (expense.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0);

          return [
            city.id,
            {
              upcoming: upcoming.count ?? 0,
              active: active.count ?? 0,
              completed: completed.count ?? 0,
              handlers: handlers.count ?? 0,
              checkedToday: checked.count ?? 0,
              pendingExpenseSum: pendingSum,
              venues: venues.count ?? 0,
            },
          ] as const;
        })
      );

      setCityStatsMap(Object.fromEntries(statsEntries));
    } catch (err: any) {
      console.warn('Could not load all live city statistics:', err);
      setError('Live city records could not be loaded completely. Showing canonical hubs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const mergedCities = useMemo(() => {
    return CANONICAL_CITIES.map(canonical => {
      const match = dbCities.find(
        db =>
          db.code?.toUpperCase() === canonical.code.toUpperCase() ||
          canonical.aliases.some(alias => alias.toLowerCase() === db.name?.toLowerCase()) ||
          db.name?.toLowerCase() === canonical.name.toLowerCase()
      );

      const stats: CityStats = match && cityStatsMap[match.id]
        ? cityStatsMap[match.id]
        : { upcoming: 0, active: 0, completed: 0, handlers: 0, checkedToday: 0, pendingExpenseSum: 0, venues: 0 };

      return {
        ...canonical,
        dbId: match?.id ?? null,
        active: match ? match.active : true,
        inventoryBase: match?.inventory_base ?? `${canonical.name} craft hub`,
        stats,
      };
    });
  }, [dbCities, cityStatsMap]);

  const filteredCities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return mergedCities;
    return mergedCities.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.landmark.toLowerCase().includes(q)
    );
  }, [mergedCities, searchTerm]);

  const grandTotals = useMemo(() => {
    return mergedCities.reduce(
      (acc, c) => ({
        upcoming: acc.upcoming + c.stats.upcoming,
        active: acc.active + c.stats.active,
        completed: acc.completed + c.stats.completed,
        handlers: acc.handlers + c.stats.handlers,
        pending: acc.pending + c.stats.pendingExpenseSum,
      }),
      { upcoming: 0, active: 0, completed: 0, handlers: 0, pending: 0 }
    );
  }, [mergedCities]);

  return (
    <main className="city-selection-page">
      <header className="city-selection-header">
        <div className="city-heading-text">
          <div className="city-eyebrow">
            <Compass size={13} className="inline-mr" /> REGIONAL OPERATIONS HUBS
          </div>
          <h1>City Selection</h1>
          <p>
            Choose an operational hub to inspect scheduled commitments, field readiness, assigned handler teams, and local logistics.
          </p>
        </div>

        <div className="city-header-actions">
          <Link href="/admin/events/new" className="button button-primary">
            <Plus size={15} /> Create event
          </Link>
        </div>
      </header>

      {/* Organization rollups bar */}
      <section className="city-selection-rollup">
        <div className="rollup-stat">
          <small>Active Hubs</small>
          <b>8 Cities</b>
        </div>
        <div className="rollup-stat">
          <small>Scheduled Events</small>
          <b>{grandTotals.upcoming}</b>
        </div>
        <div className="rollup-stat">
          <small>Live Today</small>
          <b className="stat-highlight">{grandTotals.active}</b>
        </div>
        <div className="rollup-stat">
          <small>Active Handlers</small>
          <b>{grandTotals.handlers}</b>
        </div>
        <div className="rollup-stat">
          <small>Pending Claims</small>
          <b>₹{Math.round(grandTotals.pending).toLocaleString('en-IN')}</b>
        </div>
      </section>

      {/* Search and filter bar */}
      <div className="city-search-container">
        <div className="city-search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by city name, code (e.g. MUM, BLR, CHN), or landmark…"
            aria-label="Filter cities by name or landmark"
          />
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="city-search-count">
          Showing <b>{filteredCities.length}</b> of 8 hubs
        </div>
      </div>

      {error && (
        <div className="city-error-alert" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={loadData} className="button-inline-retry">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      )}

      {/* Grid of 8 BookMyShow-inspired Pastel City Cards */}
      <section className="city-cards-grid" aria-label="Available operational cities">
        {filteredCities.map(city => {
          const destination = city.dbId ? `/admin/cities/${city.dbId}` : `/admin/cities/${city.code.toLowerCase()}`;
          return (
            <Link
              key={city.code}
              href={destination}
              className="city-picker-card"
              style={
                {
                  background: city.theme.bg,
                  borderColor: city.theme.border,
                  '--card-glow': city.theme.glow,
                  '--accent-color': city.theme.accent,
                } as React.CSSProperties
              }
            >
              {/* Card top badge */}
              <div className="city-card-topbar">
                <span
                  className="city-code-pill"
                  style={{
                    backgroundColor: city.theme.pillBg,
                    color: city.theme.pillText,
                  }}
                >
                  {city.code}
                </span>
                <span className="city-state-label">{city.state}</span>
                {city.stats.active > 0 && (
                  <span className="city-live-badge">
                    <span className="live-pulsing-dot" /> {city.stats.active} LIVE
                  </span>
                )}
              </div>

              {/* Landmark Vector Illustration */}
              <div className="city-card-art-wrap">
                <CityIllustration code={city.code} accent={city.theme.accent} />
              </div>

              {/* City title and landmark name */}
              <div className="city-card-body">
                <h2 className="city-name">{city.name}</h2>
                <p className="city-landmark-label">{city.landmark}</p>
              </div>

              {/* Operational quick metrics */}
              <div className="city-card-metrics">
                <div className="city-metric-chip" title="Upcoming scheduled events">
                  <CalendarDays size={13} />
                  <span>
                    <b>{city.stats.upcoming}</b> upcoming
                  </span>
                </div>
                <div className="city-metric-chip" title="Active field handlers">
                  <Users size={13} />
                  <span>
                    <b>{city.stats.handlers}</b> handlers
                  </span>
                </div>
              </div>

              {/* Card hover footer */}
              <div className="city-card-action">
                <span className="city-action-text">Explore operations</span>
                <div className="city-action-arrow">→</div>
              </div>
            </Link>
          );
        })}
      </section>

      {filteredCities.length === 0 && (
        <div className="city-empty-state">
          <MapPin size={32} className="empty-icon" />
          <h3>No matching cities found</h3>
          <p>Try searching for a different city name or 3-letter airport code like MUM, HYD, or BLR.</p>
          <button type="button" className="button button-secondary" onClick={() => setSearchTerm('')}>
            View all 8 cities
          </button>
        </div>
      )}
    </main>
  );
}

// ----------------------------------------------------------------------------
// Phase 4: City-Specific Operations Detail View
// ----------------------------------------------------------------------------

export function CityDetail({ cityId }: { cityId: string }) {
  const router = useRouter();
  const [cityRecord, setCityRecord] = useState<any>(null);
  const [canonical, setCanonical] = useState<CanonicalCity>(CANONICAL_CITIES[0]);
  const [events, setEvents] = useState<any[]>([]);
  const [handlers, setHandlers] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [stats, setStats] = useState<CityStats>({
    upcoming: 0,
    active: 0,
    completed: 0,
    handlers: 0,
    checkedToday: 0,
    pendingExpenseSum: 0,
    venues: 0,
  });
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'active' | 'completed'>('all');
  const [eventSearch, setEventSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-CA');
  const monthStart = `${today.slice(0, 7)}-01`;

  async function loadCityWorkspace() {
    setLoading(true);
    setError('');
    const supabase = createClient();

    try {
      // 1. Resolve city record by ID, code, or alias
      let city: any = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cityId);

      if (isUuid) {
        const { data, error: err } = await supabase
          .from('cities')
          .select('id,name,code,active,inventory_base,reimbursement_rules,local_contacts,city_admin_id,profiles!cities_city_admin_id_fkey(id,full_name,email,phone)')
          .eq('id', cityId)
          .maybeSingle();
        if (err) throw err;
        city = data;
      } else {
        const { data, error: err } = await supabase
          .from('cities')
          .select('id,name,code,active,inventory_base,reimbursement_rules,local_contacts,city_admin_id,profiles!cities_city_admin_id_fkey(id,full_name,email,phone)')
          .or(`code.ilike.${cityId},name.ilike.${cityId}`)
          .maybeSingle();
        if (err) throw err;
        city = data;
      }

      // Match canonical city profile
      const foundCanonical = CANONICAL_CITIES.find(
        c =>
          (city && (c.code.toUpperCase() === city.code?.toUpperCase() || c.aliases.includes(city.name?.toLowerCase()))) ||
          c.code.toLowerCase() === cityId.toLowerCase() ||
          c.aliases.includes(cityId.toLowerCase())
      ) ?? CANONICAL_CITIES[0];

      setCanonical(foundCanonical);

      // If city record is missing from database (e.g. unseeded hub), build a fallback city object
      const effectiveCity = city ?? {
        id: isUuid ? cityId : 'unseeded',
        name: foundCanonical.name,
        code: foundCanonical.code,
        active: true,
        inventory_base: `${foundCanonical.name} Operations Hub`,
        reimbursement_rules: { cab: 800, food: 350, currency: 'INR' },
        local_contacts: [],
        city_admin_id: null,
      };

      setCityRecord(effectiveCity);

      // 2. If we have a database city ID, load live operational records
      if (effectiveCity.id && effectiveCity.id !== 'unseeded') {
        const [eventsRes, handlersRes, venuesRes, checkinRes, expenseRes] = await Promise.all([
          supabase
            .from('events')
            .select(`
              id,
              event_code,
              name,
              type,
              event_date,
              start_time,
              end_time,
              expected_arrival_time,
              client_name,
              activity:activities(name),
              city,
              city_id,
              venue,
              address,
              status,
              required_handlers,
              event_assignments(
                id,
                handler_id,
                responsibility,
                status,
                profiles!event_assignments_handler_id_fkey(id,handler_id,full_name,job_title,phone,email)
              )
            `)
            .or(`city_id.eq.${effectiveCity.id},city.ilike.${effectiveCity.name}`)
            .order('event_date', { ascending: false }),

          supabase
            .from('profiles')
            .select('id,handler_id,full_name,job_title,status,phone,email')
            .eq('home_city_id', effectiveCity.id)
            .eq('role', 'handler')
            .order('full_name'),

          supabase
            .from('venues')
            .select('id,name,address,venue_type,contact_name,contact_phone')
            .eq('city_id', effectiveCity.id)
            .order('name'),

          supabase
            .from('attendance')
            .select('id,events!inner(city_id,event_date)', { count: 'exact', head: true })
            .eq('events.city_id', effectiveCity.id)
            .eq('events.event_date', today)
            .not('check_in_at', 'is', null),

          supabase
            .from('expenses')
            .select('amount,events!inner(city_id)')
            .eq('events.city_id', effectiveCity.id)
            .in('status', ['submitted', 'under_review']),
        ]);

        const eventRows = eventsRes.data ?? [];
        setEvents(eventRows);
        setHandlers(handlersRes.data ?? []);
        setVenues(venuesRes.data ?? []);

        const upcomingCount = eventRows.filter(e => e.status === 'upcoming').length;
        const activeCount = eventRows.filter(e => e.status === 'active').length;
        const completedCount = eventRows.filter(e => e.status === 'completed').length;
        const pendingExpense = (expenseRes.data ?? []).reduce((n: number, r: any) => n + Number(r.amount || 0), 0);

        setStats({
          upcoming: upcomingCount,
          active: activeCount,
          completed: completedCount,
          handlers: handlersRes.data?.length ?? 0,
          checkedToday: checkinRes.count ?? 0,
          pendingExpenseSum: pendingExpense,
          venues: venuesRes.data?.length ?? 0,
        });
      }
    } catch (err: any) {
      console.error('City detail load error:', err);
      setError(err?.message || 'Failed to load details for this city.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCityWorkspace();
  }, [cityId]);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (activeTab !== 'all') {
      result = result.filter(e => e.status === activeTab);
    }
    const q = eventSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(
        e =>
          e.name?.toLowerCase().includes(q) ||
          e.client_name?.toLowerCase().includes(q) ||
          e.activity?.name?.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q) ||
          e.event_code?.toLowerCase().includes(q) ||
          (e.event_assignments ?? []).some((a: any) =>
            a.profiles?.full_name?.toLowerCase().includes(q)
          )
      );
    }
    return result;
  }, [events, activeTab, eventSearch]);

  const lead = cityRecord?.profiles;

  if (loading) {
    return (
      <main className="city-detail-page">
        <div className="city-detail-loader">
          <div className="city-spinner" />
          <p>Loading {canonical.name} operations workspace…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="city-detail-page">
      {/* Quick city switcher header */}
      <div className="city-nav-bar">
        <Link href="/admin/cities" className="city-back-link">
          <ArrowLeft size={16} /> All 8 Cities
        </Link>

        {/* 8-city instant switcher pills */}
        <div className="city-switcher-pills" role="tablist" aria-label="Switch city">
          {CANONICAL_CITIES.map(c => {
            const isCurrent = c.code.toLowerCase() === canonical.code.toLowerCase();
            return (
              <button
                key={c.code}
                type="button"
                className={`switcher-pill ${isCurrent ? 'is-active' : ''}`}
                onClick={() => router.push(`/admin/cities/${c.code.toLowerCase()}`)}
                style={
                  isCurrent
                    ? {
                        backgroundColor: c.theme.pillBg,
                        color: c.theme.pillText,
                        borderColor: c.theme.accent,
                      }
                    : {}
                }
              >
                <span>{c.code}</span>
                <b>{c.name}</b>
              </button>
            );
          })}
        </div>
      </div>

      {/* City Hero Header */}
      <header
        className="city-hero-card"
        style={
          {
            background: canonical.theme.bg,
            borderColor: canonical.theme.border,
            '--accent-color': canonical.theme.accent,
          } as React.CSSProperties
        }
      >
        <div className="city-hero-left">
          <div className="city-hero-badge-row">
            <span
              className="city-code-tag"
              style={{
                backgroundColor: canonical.theme.pillBg,
                color: canonical.theme.pillText,
              }}
            >
              {canonical.code} HUB
            </span>
            <span className="city-state-tag">{canonical.state}</span>
            <span className="city-active-tag">
              <CheckCircle2 size={12} /> ACTIVE WORKSPACE
            </span>
          </div>
          <h1>{canonical.name}</h1>
          <p className="city-tagline">{canonical.tagline}</p>
          <div className="city-meta-row">
            <span title="Landmark base">
              <MapPin size={13} /> {canonical.landmark}
            </span>
            <span title="Operations base">
              <Building2 size={13} /> {cityRecord?.inventory_base ?? 'Local Operations Hub'}
            </span>
            <span title="City Lead">
              <Users size={13} /> Lead: {lead?.full_name ?? 'Central Operations Desk'}
            </span>
          </div>
        </div>

        <div className="city-hero-art">
          <CityIllustration code={canonical.code} accent={canonical.theme.accent} />
        </div>
      </header>

      {/* Real Summary Metrics */}
      <section className="city-ops-metrics-grid" aria-label="City summary metrics">
        <div className="ops-metric-card">
          <div className="metric-header">
            <span>Upcoming Events</span>
            <CalendarDays size={16} />
          </div>
          <b>{stats.upcoming}</b>
          <small>Scheduled commitments</small>
        </div>

        <div className="ops-metric-card metric-live">
          <div className="metric-header">
            <span>Active / Live</span>
            <Activity size={16} />
          </div>
          <b className="live-stat-text">{stats.active}</b>
          <small>In progress today</small>
        </div>

        <div className="ops-metric-card">
          <div className="metric-header">
            <span>Completed Events</span>
            <CheckCircle2 size={16} />
          </div>
          <b>{stats.completed}</b>
          <small>This calendar month</small>
        </div>

        <div className="ops-metric-card">
          <div className="metric-header">
            <span>City Handlers</span>
            <UserCheck size={16} />
          </div>
          <b>{stats.handlers}</b>
          <small>Active home city crew</small>
        </div>

        <div className="ops-metric-card">
          <div className="metric-header">
            <span>Today’s Check-ins</span>
            <Clock size={16} />
          </div>
          <b>{stats.checkedToday}</b>
          <small>Verified on-site</small>
        </div>

        <div className="ops-metric-card">
          <div className="metric-header">
            <span>Pending Claims</span>
            <Wallet size={16} />
          </div>
          <b>₹{Math.round(stats.pendingExpenseSum).toLocaleString('en-IN')}</b>
          <small>Awaiting review</small>
        </div>
      </section>

      {/* Main Operations Columns */}
      <div className="city-ops-layout">
        {/* Left Column: Dedicated Events Explorer */}
        <section className="city-events-panel">
          <div className="events-panel-header">
            <div>
              <h2>City Events & Operations</h2>
              <p>Events scoped strictly to {canonical.name} with real assigned handler rosters.</p>
            </div>

            <Link href="/admin/events/new" className="button button-primary button-sm">
              <Plus size={14} /> New event in {canonical.name}
            </Link>
          </div>

          {/* Filter tabs and search */}
          <div className="events-filter-toolbar">
            <div className="filter-tabs" role="tablist">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All <span>{events.length}</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'active' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                Active <span>{stats.active}</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'upcoming' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                Upcoming <span>{stats.upcoming}</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'completed' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                Completed <span>{stats.completed}</span>
              </button>
            </div>

            <div className="event-search-input">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search events, clients, activities, or venues…"
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
              />
              {eventSearch && (
                <button type="button" onClick={() => setEventSearch('')} aria-label="Clear">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Events List */}
          <div className="city-events-list">
            {filteredEvents.length === 0 ? (
              <div className="city-events-empty">
                <BriefcaseBusiness size={30} className="empty-icon" />
                <h4>No {activeTab !== 'all' ? activeTab : ''} events found for {canonical.name}</h4>
                <p>
                  {eventSearch
                    ? 'No events matched your search query.'
                    : `No events are currently scheduled under the ${canonical.name} hub.`}
                </p>
                <Link href="/admin/events/new" className="button button-secondary">
                  <Plus size={14} /> Schedule first event in {canonical.name}
                </Link>
              </div>
            ) : (
              filteredEvents.map(event => {
                const assignments = event.event_assignments ?? [];
                return (
                  <article key={event.id} className="city-event-card">
                    <div className="event-card-head">
                      <div>
                        <div className="event-eyebrow-row">
                          <span className="event-code-badge">{event.event_code || 'EVENT'}</span>
                          <span className="event-type-badge">{event.type || 'Workshop'}</span>
                          {event.activity?.name && (
                            <span className="event-activity-badge">
                              <Sparkles size={11} /> {event.activity.name}
                            </span>
                          )}
                        </div>
                        <h3 className="event-title">
                          <Link href={`/admin/events/${event.id}`} className="event-title-link">
                            {event.name}
                          </Link>
                        </h3>
                        <p className="event-client-line">
                          Client: <b>{event.client_name || 'Individual / Walk-in'}</b>
                        </p>
                      </div>

                      <div className="event-card-status-col">
                        <span className={`table-status ${event.status}`}>
                          {event.status === 'active' ? '● LIVE' : event.status.toUpperCase()}
                        </span>
                        <Link href={`/admin/events/${event.id}`} className="event-detail-link">
                          View details <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>

                    {/* Schedule and venue */}
                    <div className="event-details-meta">
                      <div className="meta-item">
                        <CalendarDays size={13} />
                        <span>
                          {new Date(`${event.event_date}T00:00:00`).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="meta-item">
                        <Clock size={13} />
                        <span>
                          Expected arrival: {formatTime(event.expected_arrival_time)}
                          {event.start_time && ` · Event: ${event.start_time.slice(0, 5)}–${event.end_time?.slice(0, 5) || 'end'}`}
                        </span>
                      </div>

                      <div className="meta-item">
                        <MapPin size={13} />
                        <span>
                          <b>{event.venue || 'Venue not set'}</b>
                          {event.address && ` · ${event.address}`}
                        </span>
                      </div>
                    </div>

                    {/* Assigned Handlers Section */}
                    <div className="event-team-row">
                      <span className="team-label">Assigned Crew ({assignments.length}):</span>
                      {assignments.length === 0 ? (
                        <span className="team-none">No handlers assigned yet</span>
                      ) : (
                        <div className="team-badges-wrap">
                          {assignments.map((assignment: any) => {
                            const p = assignment.profiles;
                            const isAck = assignment.status === 'acknowledged';
                            return (
                              <div key={assignment.id} className={`crew-member-chip ${isAck ? 'is-ack' : ''}`}>
                                <span className="crew-avatar">
                                  {(p?.full_name || 'H').charAt(0).toUpperCase()}
                                </span>
                                <div className="crew-info">
                                  <b className="crew-name">{p?.full_name || 'Handler'}</b>
                                  <small className="crew-role">
                                    {assignment.responsibility || 'Crew'} ·{' '}
                                    <span className={`ack-status ${assignment.status}`}>
                                      {assignment.status}
                                    </span>
                                  </small>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Local Workforce & Venues */}
        <aside className="city-sidebar-panel">
          {/* Workforce / Handlers */}
          <div className="ops-card-widget">
            <div className="widget-header">
              <div>
                <h3>City Handlers</h3>
                <p>Workforce mapped to {canonical.name}</p>
              </div>
              <span className="count-pill">{handlers.length}</span>
            </div>

            <div className="widget-list">
              {handlers.length === 0 ? (
                <div className="widget-empty">No handlers registered for {canonical.name} yet.</div>
              ) : (
                handlers.slice(0, 8).map(h => (
                  <div key={h.id} className="widget-row">
                    <div className="widget-avatar">
                      {(h.full_name || 'H').charAt(0).toUpperCase()}
                    </div>
                    <div className="widget-info">
                      <b>{h.full_name}</b>
                      <small>
                        {h.handler_id || 'ID pending'} · {h.job_title || 'Handler'}
                      </small>
                    </div>
                    <span className={`status-dot-tag ${h.status}`}>
                      {h.status}
                    </span>
                  </div>
                ))
              )}
            </div>

            {handlers.length > 8 && (
              <div className="widget-footer">
                <Link href="/admin/handlers" className="link-subtle">
                  View all {handlers.length} handlers →
                </Link>
              </div>
            )}
          </div>

          {/* Venues */}
          <div className="ops-card-widget">
            <div className="widget-header">
              <div>
                <h3>Saved Venues</h3>
                <p>Verified venues in {canonical.name}</p>
              </div>
              <span className="count-pill">{venues.length}</span>
            </div>

            <div className="widget-list">
              {venues.length === 0 ? (
                <div className="widget-empty">No venues saved for {canonical.name}.</div>
              ) : (
                venues.slice(0, 5).map(v => (
                  <div key={v.id} className="widget-row venue-row">
                    <Building2 size={16} className="venue-icon" />
                    <div className="widget-info">
                      <b>{v.name}</b>
                      <small>{v.address}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reimbursement Rules */}
          <div className="ops-card-widget">
            <div className="widget-header">
              <div>
                <h3>Reimbursement Guidelines</h3>
                <p>Standard policy for {canonical.name}</p>
              </div>
              <Wallet size={16} />
            </div>
            <div className="reimbursement-rules-grid">
              <div className="rule-item">
                <small>Local Cab Limit</small>
                <b>₹{cityRecord?.reimbursement_rules?.cab ?? 800} / event</b>
              </div>
              <div className="rule-item">
                <small>Food Allowance</small>
                <b>₹{cityRecord?.reimbursement_rules?.food ?? 350} / day</b>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function formatTime(val: string | null) {
  if (!val) return 'Not set';
  const match = val.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!match) return val;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
