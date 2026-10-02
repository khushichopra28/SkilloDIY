import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';

let env: Record<string, string> = {};
if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        env[k] = v;
      }
    }
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Config:', {
  hasUrl: !!url,
  hasPublishableKey: !!publishableKey,
  hasServiceKey: !!serviceKey,
});

async function main() {
  const clientKey = serviceKey || publishableKey;
  if (!url || !clientKey) {
    console.error('Missing supabase credentials');
    return;
  }
  const db = createClient(url, clientKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Query profiles for handlers
  const { data: profiles, error: pError } = await db.from('profiles').select('id, full_name, role, status, handler_id, created_at');
  console.log('Profiles result:', { profiles, pError });

  // Query handler_applications
  const { data: apps, error: aError } = await db.from('handler_applications').select('id, legal_name, status, user_id');
  console.log('Applications result:', { apps, aError });

  // Query digital_ids
  const { data: dIds, error: dError } = await db.from('digital_ids').select('*');
  console.log('Digital IDs result:', { dIds, dError });

  if (serviceKey) {
    const { data: seq, error: sError } = await db.from('handler_id_sequence').select('*');
    console.log('Sequence result:', { seq, sError });
  }
}

main().catch(console.error);
