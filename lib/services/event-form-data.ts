import { createClient } from '@/lib/supabase/server';

export async function getEventFormOptions() {
  const db = await createClient();
  const [cities, handlers] = await Promise.all([
    db.from('cities').select('id,name').eq('active',true).order('name').limit(200),
    db.from('profiles').select('id,handler_id,full_name,email').eq('role','handler').eq('status','active').eq('verification_status','VERIFIED').order('full_name').limit(500),
  ]);
  if (cities.error || handlers.error) throw new Error('Event setup choices could not be loaded.');
  return { cities:cities.data??[], handlers:handlers.data??[] };
}
