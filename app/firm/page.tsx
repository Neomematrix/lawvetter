import SiteHeader from '../SiteHeader';
import FirmProfile from './FirmProfile';
export default async function FirmPage({searchParams}:{searchParams:Promise<{name?:string|string[]}>}){
 const params=await searchParams;
 const name=typeof params.name==='string'?params.name:'';
 return <main><SiteHeader/><FirmProfile name={name}/></main>;
}
