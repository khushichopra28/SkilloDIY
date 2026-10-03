import { headers } from 'next/headers';
import PortalShell from '@/components/portal-shell';

function decodeHeaderValue(value: string | null, fallback: string) {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return fallback;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const identityVerified = requestHeaders.get('x-eventops-identity-verified') === '1';
  const role = requestHeaders.get('x-eventops-profile-role');

  // The middleware is the authentication boundary for /admin. It forwards
  // identity only after validating the Supabase session and active admin role.
  // Admin login and configuration/error redirects arrive without this claim.
  if (!identityVerified || (role !== 'super_admin' && role !== 'city_admin')) {
    return <PortalShell role={null} name="Administrator" cityName={null}>{children}</PortalShell>;
  }

  const name = decodeHeaderValue(requestHeaders.get('x-eventops-profile-name'), 'Administrator');
  const cityName = decodeHeaderValue(requestHeaders.get('x-eventops-city-name'), 'All cities');
  return <PortalShell role="admin" name={name} cityName={cityName}>{children}</PortalShell>;
}
