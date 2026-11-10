import {headers} from 'next/headers';
import {adminIdentity} from '../../db/admin-auth';
import {notFound} from 'next/navigation';
import {siteOrigin} from '../../db/site-settings';
import {publicDirectory} from '../../db/public-directory';
import type {FirmResults} from './FirmProfile';
import SiteHeader from '../SiteHeader';
import FirmProfile from './FirmProfile';
import {FirmMessageForm} from '../FirmContact';
import type {Metadata} from 'next';
import {SITE_ORIGIN} from '../seo';

type Props={searchParams:Promise<{name?:string|string[];page?:string;contact?:string}>};
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{
 const SITE_ORIGIN=await siteOrigin();
 const params=await searchParams,name=typeof params.name==='string'?params.name.trim():'';
 if(params.contact==='1')return {title:'Contact '+name,robots:{index:false,follow:false}};
 if(!name)return {title:'Georgia law firm directory',description:'Explore Georgia law firms and attorney professional records on LawVetter.',alternates:{canonical:SITE_ORIGIN+'/find-a-lawyer'}};
 const title=`${name} — Georgia Attorneys`,description=`Review attorneys associated with ${name}, including Georgia Bar status, professional records, locations, and official record links.`.slice(0,160),canonical=SITE_ORIGIN+'/firm?name='+encodeURIComponent(name);
 return {title,description,alternates:{canonical},openGraph:{title:title+' | LawVetter',description,url:canonical,type:'website'}};
}
export default async function FirmPage({searchParams}:Props){
 const params=await searchParams;
 const adminCanAdd=!!await adminIdentity(new Request('https://lawvetter.local/firm',{headers:await headers()}));
 const name=typeof params.name==='string'?params.name:'';
 const page=Math.max(1,Math.min(10000,Number.parseInt(params.page||'1')||1));let initialResult:FirmResults|undefined;try{if(name)initialResult=await publicDirectory<FirmResults>({firm:name,page});}catch(error){if((error as {status?:number}).status===404)notFound();if((error as {status?:number}).status!==503)throw error;console.error('Initial firm lookup unavailable; client can retry',error);}if(params.contact==='1'&&name)return <main><SiteHeader/><div className="page-shell account-page"><a className="firm-back" href={'/firm?name='+encodeURIComponent(name)}>Back to firm</a><FirmMessageForm name={initialResult?.firm.name||name}/></div></main>;return <main><SiteHeader/><FirmProfile name={name} initialResult={initialResult} adminCanAdd={adminCanAdd}/></main>;
}
