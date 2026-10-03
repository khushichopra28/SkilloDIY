import { cache } from 'react';
import { createClient } from './server';

export interface CachedUserProfile {
  id: string;
  role: 'super_admin' | 'city_admin' | 'handler';
  full_name: string;
  status: string;
  home_city_id: string | null;
  handler_id: string | null;
  verification_status?: string;
  cityName: string | null;
}

/**
 * Request-scoped cached getter for the current authenticated user.
 * Uses React.cache() to deduplicate auth.getUser() calls across layout,
 * pages, and nested server components within a single request.
 */
export const getCachedAuthUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
});

/**
 * Request-scoped cached getter for the current user's profile and city.
 * Uses React.cache() to eliminate duplicate profile queries across
 * layouts and server components during navigation.
 */
export const getCachedUserProfile = cache(async (): Promise<CachedUserProfile | null> => {
  try {
    const user = await getCachedAuthUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id,role,full_name,status,home_city_id,handler_id,verification_status,cities!profiles_home_city_id_fkey(name)')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) return null;

    return {
      id: profile.id,
      role: profile.role as 'super_admin' | 'city_admin' | 'handler',
      full_name: profile.full_name,
      status: profile.status,
      home_city_id: profile.home_city_id,
      handler_id: profile.handler_id,
      verification_status: profile.verification_status,
      cityName: (profile as any).cities?.name ?? null,
    };
  } catch {
    return null;
  }
});
