import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
// Server only. Never import this module from a client component.
export function createAdminClient(){const {url}=getSupabaseConfig(),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Server-side Supabase administration is not configured.');return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});}
