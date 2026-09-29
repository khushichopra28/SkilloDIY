import ForgotPasswordForm from '@/components/forgot-password';
export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<{portal?:string}>}){const {portal}=await searchParams;return <ForgotPasswordForm portal={portal==='admin'?'admin':'handler'}/>}
