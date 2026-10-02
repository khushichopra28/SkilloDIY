import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import HandlerProfileWorkspace from '@/components/handler-profile-workspace';

export const metadata = {
  title: 'My Profile · EventOps',
  description: 'Manage your personal details and view your EventOps staff identity.',
};

export default async function MyIdPage() {
  if (!hasSupabaseConfig()) redirect('/handler/login?error=configuration');

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/handler/login');

  // This is the self-scoped profile query with explicit home_city_id foreign key
  // to avoid PGRST201 ambiguous relationship errors.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,full_name,email,phone,job_title,team,handler_id,status,joined_at,photo_path,home_city_id,verification_status,cities!profiles_home_city_id_fkey(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[handler-my-id] Core profile query failed', {
      code: profileError.code ?? null,
      message: profileError.message ?? null,
      details: profileError.details ?? null,
      hint: profileError.hint ?? null,
    });
    return <Unavailable title="Your Profile could not be loaded" message="We could not retrieve your handler profile. Your access has not changed. Try again, or contact your administrator if this continues." />;
  }
  if (!profile) {
    // Middleware routes authenticated users without a handler profile to
    // onboarding. Keep this explicit fallback for independently rendered RSCs.
    return <Unavailable title="Handler profile not found" message="There is no handler profile linked to this account yet. Continue your application or ask your administrator for help." onboarding />;
  }
  if (profile.role !== 'handler') redirect(profile.role === 'super_admin' || profile.role === 'city_admin' ? '/admin' : '/handler/login?error=unauthorized');
  if (profile.status !== 'active') redirect('/handler/login?error=inactive');
  if (!profile.handler_id) redirect('/handler/onboarding');

  const [
    { data: digitalId, error: digitalIdError },
    { data: citiesData }
  ] = await Promise.all([
    supabase.from('digital_ids').select('verification_token,valid_until,created_at').eq('profile_id', user.id).maybeSingle(),
    supabase.from('cities').select('id,name,code').eq('active', true).order('name')
  ]);

  const verificationStatus = profile.verification_status ?? (digitalId?.verification_token ? 'VERIFIED' : null);

  let photoDataUrl: string | null = null;
  let photoUnavailable = false;
  if (profile.photo_path) {
    // Handler photos are stored in the private `documents` bucket by onboarding.
    // Use an authenticated signed URL so SSR props remain lightweight and avoid
    // React 19 RSC serialization recursion limits with large base64 buffers.
    const belongsToUser = profile.photo_path.startsWith(`${user.id}/`);
    if (belongsToUser) {
      const { data: signed, error: photoError } = await supabase.storage
        .from('documents')
        .createSignedUrl(profile.photo_path, 3600);
      if (!photoError && signed?.signedUrl) {
        photoDataUrl = signed.signedUrl;
      } else {
        photoUnavailable = true;
        console.warn('[handler-my-id] Profile photo unavailable', { code: photoError?.name ?? 'storage_error' });
      }
    } else {
      photoUnavailable = true;
      console.warn('[handler-my-id] Profile photo path is outside the authenticated handler folder');
    }
  }

  if (digitalIdError) {
    console.error('[handler-my-id] Digital ID record query failed', {
      code: digitalIdError.code ?? null,
      message: digitalIdError.message ?? null,
      details: digitalIdError.details ?? null,
      hint: digitalIdError.hint ?? null,
    });
  }

  return (
    <HandlerProfileWorkspace
      profile={{
        ...profile,
        verification_status: verificationStatus,
        cities: Array.isArray(profile.cities) ? profile.cities[0] ?? null : profile.cities,
      }}
      record={digitalId ?? null}
      cities={citiesData ?? []}
      origin={process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ''}
      photoDataUrl={photoDataUrl}
      photoUnavailable={photoUnavailable}
      verificationUnavailable={!verificationStatus}
      digitalIdUnavailable={Boolean(digitalIdError)}
    />
  );
}

function Unavailable({ title, message, onboarding = false }: { title: string; message: string; onboarding?: boolean }) {
  return (
    <main className="my-id-unavailable">
      <div className="my-id-unavailable-panel" role="alert">
        <span className="my-id-eyebrow">EVENTOPS · HANDLER PROFILE</span>
        <h1>{title}</h1>
        <p>{message}</p>
        <Link className="my-id-button my-id-button-primary" href={onboarding ? '/handler/onboarding' : '/handler/my-id'}>
          {onboarding ? 'Continue onboarding' : 'Try again'}
        </Link>
      </div>
    </main>
  );
}
