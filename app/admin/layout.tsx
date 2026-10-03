import PortalShell from '@/components/portal-shell';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { getCachedUserProfile } from '@/lib/supabase/cached-auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfig()) return <PortalShell role="admin" name="Administrator" cityName={null}>{children}</PortalShell>;

  const profile = await getCachedUserProfile();
  let role: 'admin' | 'handler' | null = 'admin';
  let name = 'Administrator';
  let cityName: string | null = null;

  if (profile) {
    role = profile.role === 'super_admin' || profile.role === 'city_admin' ? 'admin' : profile.role === 'handler' ? 'handler' : 'admin';
    name = profile.full_name || name;
    cityName = profile.cityName;
  }

  return <PortalShell role={role} name={name} cityName={cityName}>{children}</PortalShell>;
}
