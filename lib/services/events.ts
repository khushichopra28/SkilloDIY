import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

const eventInput = z.object({
  name: z.string().trim().min(3).max(120), type: z.string().min(1), activity_name: z.string().trim().min(1).max(160),
  activity_id: z.string().uuid().optional().or(z.literal('')), client_name: z.string().trim().max(160), description: z.string().max(4000),
  city_id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), venue: z.string().trim().min(2).max(160), address: z.string().trim().min(5).max(500),
  expected_arrival_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), expected_participants: z.number().int().min(1), age_group: z.string().max(80), theme: z.string().max(160), status: z.enum(['draft','upcoming','active','completed','cancelled','archived']),
  lead_handler_id: z.string().uuid(), member_handler_ids: z.array(z.string().uuid()).max(49),
  event_photo_path: z.string().nullable(), amount_paid: z.string().nullable(), payment_method: z.enum(['GPay','Cash']).nullable(), payment_screenshot_path: z.string().nullable(),
});

export async function saveEvent(input: unknown, eventId: string | null, uploads: { eventPhoto?: File | null; screenshot?: File | null }) {
  const draft = eventInput.parse(input);
  if (draft.member_handler_ids.includes(draft.lead_handler_id) || new Set(draft.member_handler_ids).size !== draft.member_handler_ids.length) throw new Error('A handler can only be assigned once.');
  if (draft.payment_method === 'GPay' && !(uploads.screenshot || draft.payment_screenshot_path)) throw new Error('A GPay payment screenshot is required.');
  if (draft.payment_method === 'Cash' && (uploads.screenshot || draft.payment_screenshot_path)) throw new Error('Cash payments do not use a screenshot.');
  const db = createClient();
  const idForFiles = eventId ?? crypto.randomUUID();
  let eventPhotoPath = draft.event_photo_path;
  let screenshotPath = draft.payment_method === 'GPay' ? draft.payment_screenshot_path : null;
  const uploaded: string[] = [];
  async function upload(file: File | null | undefined, kind: string) {
    if (!file) return null;
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error('Your session is no longer valid.');
    const path = `${user.id}/${idForFiles}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from('event-lead-files').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Could not upload ${kind === 'photo' ? 'event photo' : 'payment screenshot'}: ${error.message}`);
    uploaded.push(path);
    return path;
  }
  try {
    eventPhotoPath = await upload(uploads.eventPhoto, 'photo') ?? eventPhotoPath;
    screenshotPath = draft.payment_method === 'GPay' ? (await upload(uploads.screenshot, 'gpay') ?? screenshotPath) : null;
    const { data, error } = await db.rpc('save_admin_event', {
      p_event_id: eventId,
      p_event: { id: eventId ?? idForFiles, name: draft.name, type: draft.type, activity_name: draft.activity_name, activity_id: draft.activity_id || null, client_name: draft.client_name, description: draft.description, city_id: draft.city_id, event_date: draft.date, venue: draft.venue, address: draft.address, expected_arrival_time: draft.expected_arrival_time, expected_participants: draft.expected_participants, age_group: draft.age_group, theme: draft.theme, status: draft.status },
      p_lead_handler_id: draft.lead_handler_id,
      p_member_handler_ids: draft.member_handler_ids,
      p_lead_details: { event_photo_path: eventPhotoPath, amount_paid: draft.amount_paid, payment_method: draft.payment_method, payment_screenshot_path: screenshotPath },
    });
    if (error) throw new Error(error.message);
    return data as { id: string; event_code: string; name: string };
  } catch (error) {
    if (uploaded.length) await db.storage.from('event-lead-files').remove(uploaded);
    throw error;
  }
}
