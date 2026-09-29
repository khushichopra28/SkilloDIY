import CameraCheckIn from '@/components/camera-check-in';
export default async function CheckIn({params}:{params:Promise<{eventId:string}>}){const {eventId}=await params;return <main style={{padding:'30px 16px'}}><CameraCheckIn eventId={eventId}/></main>}
