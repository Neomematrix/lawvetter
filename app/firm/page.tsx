import SiteHeader from '../SiteHeader';
import FirmProfile from './FirmProfile';
export default async function FirmPage({searchParams}:{searchParams:Promise<{name?:string|string[]}>}){
 const params=await searchParams;
 const name=typeof params.name==='string'?params.name:'';
 return <main><SiteHeader/><FirmProfile name={name}/><footer><p>Professional records from the State Bar of Georgia. Firm affiliations reflect the imported directory and may change.</p><a href="/">CounselCheck home</a></footer></main>;
}
