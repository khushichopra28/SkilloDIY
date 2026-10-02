import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import type { City, EventDraft, EventRecord, Role } from '@/types/domain';

const eventInput = z.object({
  name: z.string().trim().min(3, 'Please enter an event name.').max(120),
  type: z.enum(['Birthday Party', 'Playdate / Special Occasion', 'Corporate Workshop'], { errorMap: () => ({ message: 'Please select an event type.' }) }),
  activity_id: z.string().uuid('Please select an activity.'),
  client_name: z.string().trim().min(1, 'Please enter the client name.').max(160),
  description: z.string().max(4000),
  city_id: z.string().uuid('Please select a city.'),
  date: z.string().refine(value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Please select a valid event date.'),
  venue: z.string().trim().min(2, 'Please enter a venue name.').max(160),
  address: z.string().trim().min(5, 'Please enter the full address.').max(500),
  expected_arrival_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter the expected handler arrival time.'),
  expected_participants: z.number().int().min(1, 'Expected participants must be a positive whole number.'),
  age_group: z.string().max(80),
  theme: z.string().max(160),
  status: z.enum(['draft', 'upcoming']),
});

function queryMessage(context: string, message: string) {
  if (process.env.NODE_ENV === 'development') return `${context}: ${message}`;
  return context;
}

export async function getWorkspaceContext() {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Your session is no longer valid. Sign in again.');

  // Super admins can read multiple organization profiles under RLS. Always scope this lookup
  // to the authenticated user's own profile before using maybeSingle().
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,organization_id,role,home_city_id,status')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw new Error(queryMessage('Could not load your administrator profile', profileError.message));
  if (!profile || profile.status !== 'active') throw new Error('Your session is no longer valid. Sign in again.');
  if (!['super_admin', 'city_admin'].includes(profile.role as string)) throw new Error('Administrator access is required.');

  const [cityResult, activityResult] = await Promise.all([
    supabase.from('cities').select('id,name,code,active')
      .eq('organization_id', profile.organization_id).eq('active', true).order('name'),
    supabase.from('activities').select('id,name')
      .eq('organization_id', profile.organization_id).eq('active', true).order('name'),
  ]);
  if (cityResult.error) throw new Error(queryMessage('Could not load the cities available to your account', cityResult.error.message));
  if (activityResult.error) throw new Error(queryMessage('Could not load the configured Skill-O activities', activityResult.error.message));

  return {
    supabase,
    profile: profile as { id: string; organization_id: string; role: Role; home_city_id: string | null; status: string },
    cities: (cityResult.data ?? []) as City[],
    activities: activityResult.data ?? [],
  };
}

export async function createEvent(input: EventDraft) {
  const draft = eventInput.parse(input);
  const { supabase, profile, cities, activities } = await getWorkspaceContext();
  const city = cities.find(item => item.id === draft.city_id);
  if (!city) throw new Error('Please select a city available to your account.');
  if (!activities.some(item => item.id === draft.activity_id)) throw new Error('Please select a configured Skill-O activity.');

  const { data, error } = await supabase.from('events').insert({
    organization_id: profile.organization_id,
    created_by: profile.id,
    event_code: null,
    name: draft.name,
    type: draft.type,
    description: draft.description.trim() || null,
    client_name: draft.client_name.trim(),
    event_date: draft.date,
    venue: draft.venue.trim(),
    address: draft.address.trim(),
    city: city.name,
    city_id: city.id,
    activity_id: draft.activity_id,
    client_id: null,
    expected_arrival_time: draft.expected_arrival_time,
    expected_participants: draft.expected_participants,
    age_group: draft.age_group.trim() || null,
    theme: draft.theme.trim() || null,
    status: draft.status,
    required_handlers: 0,
  }).select('id,event_code,name').single();

  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('Event creation failed:', error);
    throw new Error(queryMessage('Could not save this event. Check the required details and your city permissions', error.message));
  }
  return data;
}

export async function listEvents() {
  const supabase = createClient();
  const { data, error } = await supabase.from('events')
    .select('id,event_code,name,type,activity_id,activity:activities(name),client_name,event_date,expected_arrival_time,venue,address,city,city_id,status,required_handlers,cities(name,code)')
    .order('event_date', { ascending: true });
  if (error) throw new Error(queryMessage('Events could not be loaded. Refresh the page and try again', error.message));
  return (data ?? []) as unknown as EventRecord[];
}
