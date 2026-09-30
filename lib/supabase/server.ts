import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseConfig, SUPABASE_CONFIG_ERROR } from './config';

export async function createClient(){
  const {url,key}=getSupabaseConfig();
  if(!url||!key)throw new Error(SUPABASE_CONFIG_ERROR);
  const store=await cookies();
  return createServerClient(url,key,{cookies:{getAll(){return store.getAll();},setAll(cookiesToSet:{name:string;value:string;options:CookieOptions}[]){try{cookiesToSet.forEach(({name,value,options})=>store.set(name,value,options));}catch{}}}});
}
