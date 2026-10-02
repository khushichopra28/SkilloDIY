import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import LanyardScene from './lanyard-scene';

export const metadata = {
  title: 'My Digital ID · EventOps',
  description: 'Your EventOps handler identity credential.',
};

export default async function MyIdPage() {
  if (!hasSupabaseConfig()) redirect('/handler/login?error=configuration');

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/handler/login');

  // This is the same self-scoped profile query used by the existing handler
  // workspace, with only the additional verification state required by the ID.
  // Keep the core profile read aligned with the existing handler workspace.
  // Verification metadata is read separately so a missing/out-of-date optional
  // column cannot prevent the authenticated handler's identity card rendering.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,full_name,email,job_title,team,handler_id,status,joined_at,photo_path,home_city_id,cities!profiles_home_city_id_fkey(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[handler-my-id] Core profile query failed', {
      code: profileError.code ?? null,
      message: profileError.message ?? null,
      details: profileError.details ?? null,
      hint: profileError.hint ?? null,
    });
    return <Unavailable title="Your ID could not be loaded" message="We could not retrieve your handler profile. Your access has not changed. Try again, or contact your administrator if this continues." />;
  }
  if (!profile) {
    // Middleware routes authenticated users without a handler profile to
    // onboarding. Keep this explicit fallback for independently rendered RSCs.
    return <Unavailable title="Handler profile not found" message="There is no handler profile linked to this account yet. Continue your application or ask your administrator for help." onboarding />;
  }
  if (profile.role !== 'handler') redirect(profile.role === 'super_admin' || profile.role === 'city_admin' ? '/admin' : '/handler/login?error=unauthorized');
  if (profile.status !== 'active') redirect('/handler/login?error=inactive');
  if (!profile.handler_id) redirect('/handler/onboarding');

  const { data: verification, error: verificationError } = await supabase
    .from('profiles')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle();
  if (verificationError) {
    console.error('[handler-my-id] Verification status query failed', {
      code: verificationError.code ?? null,
      message: verificationError.message ?? null,
      details: verificationError.details ?? null,
      hint: verificationError.hint ?? null,
    });
  }
  const verificationStatus = verificationError ? null : verification?.verification_status ?? null;

  let photoDataUrl: string | null = null;
  let photoUnavailable = false;
  if (profile.photo_path) {
    // Handler photos are stored in the private `documents` bucket by onboarding.
    // Download through the authenticated Supabase client so exports never depend
    // on cross-origin access to a short-lived signed URL.
    const belongsToUser = profile.photo_path.startsWith(`${user.id}/`);
    if (belongsToUser) {
      const { data: photo, error: photoError } = await supabase.storage
        .from('documents')
        .download(profile.photo_path);
      if (!photoError && photo) {
        const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)
          ? photo.type
          : null;
        if (contentType) {
          const encoded = Buffer.from(await photo.arrayBuffer()).toString('base64');
          photoDataUrl = `data:${contentType};base64,${encoded}`;
        } else {
          photoUnavailable = true;
        }
      } else {
        photoUnavailable = true;
        console.warn('[handler-my-id] Profile photo unavailable', { code: photoError?.name ?? 'storage_error' });
      }
    } else {
      photoUnavailable = true;
      console.warn('[handler-my-id] Profile photo path is outside the authenticated handler folder');
    }
  }

  const { data: digitalId, error: digitalIdError } = await supabase
    .from('digital_ids')
    .select('verification_token,valid_until,created_at')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (digitalIdError) {
    console.error('[handler-my-id] Digital ID record query failed', {
      code: digitalIdError.code ?? null,
      message: digitalIdError.message ?? null,
      details: digitalIdError.details ?? null,
      hint: digitalIdError.hint ?? null,
    });
  }

  return (
    <LanyardScene
      profile={{ ...profile, verification_status: verificationStatus, cities: Array.isArray(profile.cities) ? profile.cities[0] ?? null : profile.cities }}
      record={digitalId ?? null}
      origin={process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ''}
      photoDataUrl={photoDataUrl}
      photoUnavailable={photoUnavailable}
      verificationUnavailable={Boolean(verificationError)}
      digitalIdUnavailable={Boolean(digitalIdError)}
    />
  );
}

function Unavailable({ title, message, onboarding = false }: { title: string; message: string; onboarding?: boolean }) {
  return (
    <main className="my-id-unavailable">
      <div className="my-id-unavailable-panel" role="alert">
        <span className="my-id-eyebrow">EVENTOPS · HANDLER IDENTITY</span>
        <h1>{title}</h1>
        <p>{message}</p>
        <Link className="my-id-button my-id-button-primary" href={onboarding ? '/handler/onboarding' : '/handler/my-id'}>
          {onboarding ? 'Continue onboarding' : 'Try again'}
        </Link>
      </div>
    </main>
  );
}
