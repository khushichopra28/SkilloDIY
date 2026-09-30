import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig, SUPABASE_CONFIG_ERROR } from './config';

export function createClient(){
  const {url,key}=getSupabaseConfig();
  if(!url||!key)throw new Error(SUPABASE_CONFIG_ERROR);
  return createBrowserClient(url,key);
}
