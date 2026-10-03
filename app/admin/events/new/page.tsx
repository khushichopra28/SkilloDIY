import EventCreateForm from '@/components/event-create-form';
import { getEventFormOptions } from '@/lib/services/event-form-data';
export default async function NewEventPage(){const options=await getEventFormOptions();return <main className="workflow-page"><EventCreateForm {...options}/></main>}
