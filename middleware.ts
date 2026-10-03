import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

function goTo(request: NextRequest, path: string, error?: string) {
  const target = request.nextUrl.clone();
  target.pathname = path;
  target.search = '';
  if (error) target.searchParams.set('error', error);
  return NextResponse.redirect(target);
}

const identityHeaderNames = [
  'x-eventops-identity-verified',
  'x-eventops-profile-role',
  'x-eventops-profile-name',
  'x-eventops-city-name',
] as const;

function cleanRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  identityHeaderNames.forEach(name => headers.delete(name));
  return headers;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminArea = path === '/admin' || path.startsWith('/admin/');
  const isHandlerArea = path === '/handler' || path.startsWith('/handler/');
  const isAdminLogin = path === '/admin/login';
  const isHandlerLogin = path === '/handler/login';
  const isHandlerSignup = path === '/handler/signup';
  const isHandlerOnboarding = path === '/handler/onboarding';
  const isHandlerMyId = path === '/handler/my-id';
  const cleanHeaders = cleanRequestHeaders(request);
  const { url, key } = getSupabaseConfig();

  // Never serve a protected workspace when its identity service is unconfigured.
  if (!url || !key) {
    if (isAdminArea && !isAdminLogin && !path.startsWith('/api/')) return goTo(request, '/admin/login', 'configuration');
    if (isHandlerArea && !isHandlerLogin && !isHandlerSignup) return goTo(request, '/handler/login', 'configuration');
    return NextResponse.next({ request: { headers: cleanHeaders } });
  }

  // If the path is public and not part of admin/handler/auth, bypass remote identity checks
  const isProtectedArea = isAdminArea || isHandlerArea;
  const isAuthAction = isAdminLogin || isHandlerLogin || isHandlerSignup || isHandlerOnboarding || isHandlerMyId;
  if (!isProtectedArea && !isAuthAction && !path.startsWith('/api/')) {
    return NextResponse.next({ request: { headers: cleanHeaders } });
  }

  // Fast check: inspect request cookies for Supabase auth tokens before making network calls
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(c => c.name.startsWith('sb-') || c.name.includes('-auth-token'));

  if (!hasAuthCookie) {
    if (isAdminArea && !isAdminLogin && !path.startsWith('/api/')) {
      return goTo(request, '/admin/login');
    }
    if (isHandlerArea && !isHandlerLogin && !isHandlerSignup) {
      return goTo(request, '/handler/login');
    }
    if (isAdminLogin || isHandlerLogin || isHandlerSignup) {
      return NextResponse.next({ request: { headers: cleanHeaders } });
    }
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isAdminArea && !isAdminLogin && !path.startsWith('/api/')) return goTo(request, '/admin/login');
    if (isHandlerArea && !isHandlerLogin && !isHandlerSignup) {
      return goTo(request, '/handler/login');
    }
    return response;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,status,handler_id,verification_status,full_name,cities!profiles_home_city_id_fkey(name)')
    .eq('id', user.id)
    .maybeSingle();

  // The ID page performs its own authenticated, self-scoped profile lookup and
  // renders a retry/missing-profile state. Avoid routing a transient lookup
  // failure through onboarding, whose independent profile read can redirect
  // back to /handler. The page still enforces handler role and active status.
  if (isHandlerMyId && (profileError || !profile)) return response;

  if (profileError || !profile) {
    if (!profileError && !isAdminArea && !isAdminLogin) {
      if (isHandlerOnboarding) return response;
      if (isHandlerSignup || isHandlerLogin) return goTo(request, '/handler/onboarding');
      if (isHandlerArea) return goTo(request, '/handler/onboarding');
      return response;
    }
    await supabase.auth.signOut();
    if (isAdminArea) return goTo(request, '/admin/login', profileError ? 'profile_lookup' : 'unlinked');
    if (isHandlerArea) return goTo(request, '/handler/login', profileError ? 'profile_lookup' : 'unlinked');
    return goTo(request, '/handler/login', profileError ? 'profile_lookup' : 'unlinked');
  }

  if (profile.status !== 'active') {
    await supabase.auth.signOut();
    return goTo(request, profile.role === 'handler' ? '/handler/login' : '/admin/login', 'inactive');
  }

  if (profile.role === 'handler' && !profile.handler_id) {
    if (isHandlerOnboarding) return response;
    return goTo(request, '/handler/onboarding');
  }

  const isAdmin = profile.role === 'super_admin' || profile.role === 'city_admin';
  if (isAdminArea && !isAdmin) {
    return goTo(request, '/handler');
  }
  if (isHandlerArea && profile.role !== 'handler') {
    return goTo(request, '/admin');
  }

  if (profile.role === 'handler' && profile.verification_status !== 'VERIFIED') {
    if (isHandlerOnboarding || isHandlerMyId) {
      return response;
    }
    if (isHandlerArea) return goTo(request, '/handler/onboarding');
  }

  if (isHandlerSignup && profile.role === 'handler') {
    return goTo(request, '/handler');
  }
  if (isHandlerLogin && profile.role === 'handler') {
    return goTo(request, '/handler');
  }
  if (isAdminLogin && isAdmin) return goTo(request, '/admin');

  // Forward the already-verified administrator identity to the RSC layer.
  // These values are only trusted because incoming copies were stripped above
  // and this branch is reached after getUser(), profile, status, and role checks.
  if (isAdminArea && isAdmin) {
    const verifiedHeaders = cleanRequestHeaders(request);
    verifiedHeaders.set('x-eventops-identity-verified', '1');
    verifiedHeaders.set('x-eventops-profile-role', profile.role);
    verifiedHeaders.set('x-eventops-profile-name', encodeURIComponent(profile.full_name ?? 'Administrator'));
    const cityRelation = (profile as any).cities;
    const city = Array.isArray(cityRelation) ? cityRelation[0]?.name : cityRelation?.name;
    if (city) verifiedHeaders.set('x-eventops-city-name', encodeURIComponent(city));

    const verifiedResponse = NextResponse.next({ request: { headers: verifiedHeaders } });
    response.cookies.getAll().forEach(cookie => verifiedResponse.cookies.set(cookie));
    return verifiedResponse;
  }

  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
