import { createClient } from '@supabase/supabase-js';
// Server only. Never import this module from a client component.
export function createAdminClient(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Server configuration is incomplete');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{autoRefreshToken:false,persistSession:false}});}
