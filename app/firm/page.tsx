import SiteHeader from '../SiteHeader';
import FirmProfile from './FirmProfile';
import type {Metadata} from 'next';
import {SITE_ORIGIN} from '../seo';

type Props={searchParams:Promise<{name?:string|string[]}>};
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{
 const params=await searchParams,name=typeof params.name==='string'?params.name.trim():'';
 if(!name)return {title:'Georgia law firm directory',description:'Explore Georgia law firms and attorney professional records on LawVetter.',alternates:{canonical:SITE_ORIGIN+'/find-a-lawyer'}};
 const title=`${name} — Georgia Attorneys`,description=`Review attorneys associated with ${name}, including Georgia Bar status, professional records, locations, and official record links.`.slice(0,160),canonical=SITE_ORIGIN+'/firm?name='+encodeURIComponent(name);
 return {title,description,alternates:{canonical},openGraph:{title:title+' | LawVetter',description,url:canonical,type:'website'}};
}
export default async function FirmPage({searchParams}:Props){
 const params=await searchParams;
 const name=typeof params.name==='string'?params.name:'';
 return <main><SiteHeader/><FirmProfile name={name}/></main>;
}
