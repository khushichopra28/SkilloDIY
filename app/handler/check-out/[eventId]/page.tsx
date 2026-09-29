import CameraCheckIn from '@/components/camera-check-in';
export default async function CheckOut({params}:{params:Promise<{eventId:string}>}){const {eventId}=await params;return <main style={{padding:'30px 16px'}}><CameraCheckIn eventId={eventId} kind="check_out"/></main>}
