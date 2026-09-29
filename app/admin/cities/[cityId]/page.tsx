import {CityDetail} from '@/components/cities-workspace';
export default async function CityPage({params}:{params:Promise<{cityId:string}>}){const {cityId}=await params;return <CityDetail cityId={cityId}/>}
