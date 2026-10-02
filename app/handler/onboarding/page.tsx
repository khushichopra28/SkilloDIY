import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import HandlerOnboarding from '@/components/handler-onboarding';

export default async function HandlerOnboardingPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/handler/login');
  const {data:profile}=await supabase.from('profiles').select('id,role,status,handler_id,verification_status').eq('id',user.id).maybeSingle();
  if(profile){if(profile.role!=='handler')redirect('/admin');if(profile.status==='active'&&profile.verification_status==='VERIFIED'&&profile.handler_id)redirect('/handler');}
  const {error:startError}=await supabase.rpc('ensure_handler_application');
  const [{data:application,error:applicationError},{data:verification},{data:cities,error:citiesError}]=await Promise.all([
    supabase.from('handler_applications').select('id,legal_name,preferred_name,phone,home_city_id,profile_photo_path,emergency_contact_name,emergency_contact_phone,skills_experience,availability,preferred_event_locations,status,profile_completion,submitted_at,consented_at').eq('user_id',user.id).maybeSingle(),
    supabase.from('handler_verifications').select('document_type,document_path,status,submitted_at,review_note').eq('user_id',user.id).maybeSingle(),
    supabase.rpc('list_onboarding_cities')
  ]);
  const setupError=startError?.message??applicationError?.message??citiesError?.message??null;
  let photoUrl:string|null=null;
  if(application?.profile_photo_path){const {data}=await supabase.storage.from('documents').createSignedUrl(application.profile_photo_path,600);photoUrl=data?.signedUrl??null;}
  let identityDocumentAvailable=false;
  if(verification?.document_path){const {data}=await supabase.storage.from('identity-documents').createSignedUrl(verification.document_path,30);identityDocumentAvailable=!!data?.signedUrl;}
  const initialStep=!application||application.profile_completion<100?0:application.status==='resubmission_required'||application.status==='rejected'?1:identityDocumentAvailable?2:1;
  return <HandlerOnboarding userId={user.id} email={user.email??''} application={application as any} verification={verification as any} cities={(cities??[]) as any} photoUrl={photoUrl} identityDocumentAvailable={identityDocumentAvailable} initialStep={initialStep} setupError={setupError} callbackError={(await searchParams).error??''}/>;
}
