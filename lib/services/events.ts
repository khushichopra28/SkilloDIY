import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

const eventInput = z.object({
  name: z.string().trim().min(3).max(120), type: z.string().min(1), activity_name: z.string().trim().min(1).max(160),
  activity_id: z.string().uuid().optional().or(z.literal('')), client_name: z.string().trim().max(160), description: z.string().max(4000),
  city_id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), venue: z.string().trim().min(2).max(160), address: z.string().trim().min(5).max(500),
  venue_id: z.string().uuid().nullable(), latitude: z.number().finite().min(-90).max(90).nullable(), longitude: z.number().finite().min(-180).max(180).nullable(), google_place_id: z.string().trim().max(300).nullable(),
  expected_arrival_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), expected_participants: z.number().int().min(1), age_group: z.string().max(80), theme: z.string().max(160), status: z.enum(['draft','upcoming','active','completed','cancelled','archived']),
  lead_handler_id: z.string().uuid(), member_handler_ids: z.array(z.string().uuid()).max(49),
});

export async function saveEvent(input: unknown, eventId: string | null) {
  const draft = eventInput.parse(input);
  if (draft.member_handler_ids.includes(draft.lead_handler_id) || new Set(draft.member_handler_ids).size !== draft.member_handler_ids.length) throw new Error('A handler can only be assigned once.');
  const db = createClient();
  const idForFiles = eventId ?? crypto.randomUUID();
  const { data, error } = await db.rpc('save_admin_event_with_venue', {
    p_event_id: eventId,
    p_event: { id: eventId ?? idForFiles, name: draft.name, type: draft.type, activity_name: draft.activity_name, activity_id: draft.activity_id || null, client_name: draft.client_name, description: draft.description, city_id: draft.city_id, event_date: draft.date, venue: draft.venue, address: draft.address, expected_arrival_time: draft.expected_arrival_time, expected_participants: draft.expected_participants, age_group: draft.age_group, theme: draft.theme, status: draft.status },
    p_lead_handler_id: draft.lead_handler_id,
    p_member_handler_ids: draft.member_handler_ids,
    p_lead_details: null,
    p_venue: { venue_id: draft.venue_id, name: draft.venue, address: draft.address, latitude: draft.latitude, longitude: draft.longitude, google_place_id: draft.google_place_id },
  });
  if (error) throw new Error(error.message);
  return data as { id: string; event_code: string; name: string };
}
