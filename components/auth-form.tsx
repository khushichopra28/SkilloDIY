'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/supabase/config';

type Portal = 'admin' | 'handler';
type BusyState = '' | 'password' | 'google';
type Profile = { role: 'super_admin' | 'city_admin' | 'handler'; status: string; handler_id: string | null; verification_status?: string };

const configured = hasSupabaseConfig();

function messageForCode(code: string | undefined, portal: Portal) {
  if (code === 'configuration') return 'This workspace is not connected to Supabase yet. Ask your administrator to finish setup.';
  if (code === 'unlinked') return portal === 'handler'
    ? 'This Google account is not linked to a Skillo handler account. Please contact your administrator.'
    : 'Your account is signed in, but no authorized profile is linked to it. Please contact your administrator.';
  if (code === 'inactive') return portal === 'handler' ? 'Your handler account has not been activated yet. Please contact your Skillo administrator.' : 'Your administrator account is not active. Please contact your organization owner.';
  if (code === 'profile_lookup') return 'We could not confirm your workspace access. Please try again or contact your administrator.';
  if (code === 'google') return 'Google sign-in could not be completed. Check that Google sign-in is configured for this workspace, then try again.';
  if (code === 'cancelled') return 'Google sign-in was cancelled. You can try again or use your work email and password.';
  if (code === 'session') return 'Your sign-in could not be completed. Please try again.';
  return '';
}

export default function AuthForm({ kind }: { kind: Portal }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<BusyState>('');
  const router = useRouter();
  const isAdmin = kind === 'admin';

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error') ?? '';
    if (code) setError(messageForCode(code, kind));
  }, [kind]);

  async function acceptAuthenticatedUser() {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      await supabase.auth.signOut();
      setError('Your sign-in could not be confirmed. Please try again.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role,status,handler_id,verification_status')
      .eq('id', user.id)
      .maybeSingle<Profile>();

    if (profileError) {
      await supabase.auth.signOut();
      setError('We could not confirm your workspace access. Please try again or contact your administrator.');
      return;
    }
    if (!profile) {
      if (!isAdmin) {
        const { error: onboardingError } = await supabase.rpc('ensure_handler_application');
        if (onboardingError) {
          setError('Your account is signed in, but onboarding could not be started. Please try again or contact your Skillo administrator.');
          return;
        }
        router.replace('/handler/onboarding');
        router.refresh();
        return;
      }
      await supabase.auth.signOut();
      setError('Your account is signed in, but no administrator profile is linked to it. Please contact your administrator.');
      return;
    }
    if (profile.status !== 'active') {
      await supabase.auth.signOut();
      setError(isAdmin ? 'Your account is not active. Please contact your administrator.' : 'Your handler account has not been activated yet. Please contact your Skillo administrator.');
      return;
    }
    if (profile.role === 'handler' && !profile.handler_id) {
      await supabase.auth.signOut();
      setError('Your account is signed in, but no handler profile is linked to it. Please contact your administrator.');
      return;
    }

    if (profile.role === 'handler') {
      if (profile.verification_status && profile.verification_status !== 'VERIFIED') {
        router.replace('/handler/onboarding');
        router.refresh();
        return;
      }
      router.replace('/handler');
    } else if (profile.role === 'super_admin' || profile.role === 'city_admin') {
      router.replace('/admin');
    } else {
      await supabase.auth.signOut();
      setError('This account does not have access to either Skillo portal. Please contact your administrator.');
      return;
    }
    router.refresh();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid work email address.');
      return;
    }
    if (password.length < 8) {
      setError('Enter the password for your Skillo account.');
      return;
    }
    if (!configured) {
      setError(messageForCode('configuration', kind));
      return;
    }
    setBusy('password');
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({ email: cleanEmail, password });
      if (authError) {
        if (authError.code === 'email_not_confirmed') setError('Confirm your email using the secure link sent by your administrator, then try again.');
        else if (authError.code === 'user_banned') setError('Your account is not active. Please contact your administrator.');
        else if (authError.status === 429) setError('There have been too many sign-in attempts. Wait a moment and try again.');
        else if (authError.code === 'invalid_credentials' || authError.status === 400) setError('Your email or password is incorrect.');
        else setError('We could not reach the sign-in service. Check your connection and try again.');
        return;
      }
      await acceptAuthenticatedUser();
    } catch {
      setError('We could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setBusy('');
    }
  }

  async function continueWithGoogle() {
    if (busy) return;
    setError('');
    if (!configured) {
      setError(messageForCode('configuration', kind));
      return;
    }
    setBusy('google');
    try {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) {
        setError(oauthError.code === 'provider_disabled'
          ? 'Google sign-in has not been enabled for this workspace. Please use your work email or contact your administrator.'
          : 'Google sign-in could not be started. Check that Google sign-in is configured for this workspace, then try again.');
        setBusy('');
      }
    } catch {
      setError('Google sign-in could not be started. Check that Google sign-in is configured for this workspace, then try again.');
      setBusy('');
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Link href="/" className="entry-brand"><span className="entry-mark">S</span><span>SKILLO</span></Link>
        <div className="auth-brand-copy">
          <div className="eyebrow">EVENT OPERATIONS</div>
          <h1>{isAdmin ? 'Every moving part,' : 'Your next event,'}<br />{isAdmin ? 'in good hands.' : 'all in one place.'}</h1>
          <p>{isAdmin ? 'A clear view of the people and details behind each event.' : 'Your assignments, attendance and event day essentials.'}</p>
          <div className="secure-note"><ShieldCheck size={17} />{isAdmin ? 'Restricted administrator access' : 'Secure handler access'}</div>
        </div>
        <small>Internal workspace · Skill-O Crafts</small>
      </section>
      <section className="auth-content">
        <form className="auth-form" onSubmit={submit} noValidate>
          <Link href="/" className="back-link"><ArrowLeft size={14} /> Back to Skillo</Link>
          <div className="eyebrow">{isAdmin ? 'ADMINISTRATOR SIGN IN' : 'HANDLER PORTAL'}</div>
          <h2>{isAdmin ? 'Welcome back' : 'Sign in to your account'}</h2>
          <p className="auth-description">{isAdmin ? 'Sign in with your authorized administrator account.' : 'Use your Skillo handler account to access assigned events and event-day operations.'}</p>
          <label htmlFor="email">Work email</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@organization.com" disabled={!!busy} />
          <div className="password-label"><label htmlFor="password">Password</label><Link href={`/forgot-password?portal=${kind}`}>Forgot password?</Link></div>
          <div className="password-input">
            <input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" disabled={!!busy} />
            <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)} disabled={!!busy}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {error && <div className="auth-error" role="alert" aria-live="polite">{error}</div>}
          <button className="auth-submit" disabled={!!busy}>
            {busy === 'password' ? <><LoaderCircle size={15} className="auth-spinner" />Signing in...</> : 'Sign in'}
          </button>
          {!isAdmin && <>
            <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
            <button type="button" className="google-submit" onClick={continueWithGoogle} disabled={!!busy}>
              {busy === 'google' ? <><LoaderCircle size={15} className="auth-spinner" />Connecting to Google...</> : <><GoogleMark />Continue with Google</>}
            </button>
            <p className="auth-footnote handler-contact">New to EventOps? <Link href="/handler/signup"><b>Create a handler account</b></Link><span>New handlers complete an application and verification before activation.</span></p>
          </>}
          {isAdmin && <p className="auth-footnote">Administrator access is managed by your organization.</p>}
        </form>
      </section>
    </main>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7.1v-5.3H5.8a20 20 0 0 0 0 17.7l6.8-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>;
}

