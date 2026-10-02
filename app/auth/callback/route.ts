import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';import {hasSupabaseConfig} from '@/lib/supabase/config';

function safePath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function loginFor(path: string) {
  return path.startsWith('/admin') ? '/admin/login' : '/handler/login';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = safePath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const providerError = url.searchParams.get('error');
  const isPasswordReset = requested.startsWith('/update-password');

  if (providerError) {
    const target = new URL(loginFor(requested), url.origin);
    target.searchParams.set('error', providerError === 'access_denied' ? 'cancelled' : 'google');
    return NextResponse.redirect(target);
  }
  if (!code) {
    const target = new URL(loginFor(requested), url.origin);
    target.searchParams.set('error', hasSupabaseConfig() ? 'session' : 'configuration');
    return NextResponse.redirect(target);
  }
  if (!hasSupabaseConfig()) {
    const target = new URL(loginFor(requested), url.origin);
    target.searchParams.set('error', 'configuration');
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const target = new URL(loginFor(requested), url.origin);
    target.searchParams.set('error', 'session');
    return NextResponse.redirect(target);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    await supabase.auth.signOut();
    const target = new URL(loginFor(requested), url.origin);
    target.searchParams.set('error', 'session');
    return NextResponse.redirect(target);
  }

  // Recovery links need their authenticated session to set a new password.
  if (isPasswordReset) return NextResponse.redirect(new URL(requested, url.origin));

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,status,handler_id,verification_status')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) {
    if (!profileError && !requested.startsWith('/admin')) {
      const { error: onboardingError } = await supabase.rpc('ensure_handler_application');
      if (!onboardingError) return NextResponse.redirect(new URL('/handler/onboarding', url.origin));
      return NextResponse.redirect(new URL('/handler/onboarding?error=setup', url.origin));
    }
    await supabase.auth.signOut();
    const target = new URL(loginFor(requested), url.origin);
    target.searchParams.set('error', profileError ? 'profile_lookup' : 'unlinked');
    return NextResponse.redirect(target);
  }
  if (profile.status !== 'active') {
    await supabase.auth.signOut();
    const target = new URL(loginFor(requested), url.origin);
    target.searchParams.set('error', 'inactive');
    return NextResponse.redirect(target);
  }
  if (profile.role === 'handler') {
    if (!profile.handler_id || profile.verification_status !== 'VERIFIED') return NextResponse.redirect(new URL('/handler/onboarding', url.origin));
    return NextResponse.redirect(new URL('/handler', url.origin));
  }
  if (profile.role === 'super_admin' || profile.role === 'city_admin') {
    return NextResponse.redirect(new URL('/admin', url.origin));
  }

  await supabase.auth.signOut();
  const target = new URL(loginFor(requested), url.origin);
  target.searchParams.set('error', 'unlinked');
  return NextResponse.redirect(target);
}
