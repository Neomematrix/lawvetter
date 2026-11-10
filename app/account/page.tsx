import {redirect} from 'next/navigation';
import {ownedFirms} from '../../db/firm-access';
import {headers} from 'next/headers';
import {clientIdentity} from '../../db/client-auth';
import {accountDashboardPath} from '../../db/account-dashboard';
import {siteOrigin,publicSettings} from '../../db/site-settings';
import type {Metadata} from 'next';
import AttorneyLogin from './AttorneyLogin';
import AttorneyBenefits from './AttorneyBenefits';
import {SITE_ORIGIN} from '../seo';
const description='Sign up and claim your attorney profile on LawVetter. Get free visitor analytics after claim approval, track profile views and search activity, and connect with prospective clients.';
export async function generateMetadata():Promise<Metadata>{const settings=await publicSettings(),SITE_ORIGIN=settings.origin;return {title:'For Attorneys: Rankings, Profiles and Client Connections',description,alternates:{canonical:SITE_ORIGIN+'/account'},robots:{index:true,follow:true,googleBot:{index:true,follow:true}},openGraph:{title:'Connect with clients and grow your presence | LawVetter',description,url:SITE_ORIGIN+'/account',type:'website',images:[{url:SITE_ORIGIN+'/attorney-community-columns.webp',width:900,height:1350,alt:'Sunlight between stone columns'}]}};}
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{bar?:string}>}){
 const {bar}=await searchParams;
 let firmOnly=false;
 let initialSession:'attorney'|'client'|'guest'|undefined;
 try{
  const client=await clientIdentity(new Request(SITE_ORIGIN+'/account',{headers:await headers()}));
  initialSession=client?(await accountDashboardPath(client,true)==='/account'?'attorney':'client'):'guest';
  if(client&&initialSession==='client')firmOnly=(await ownedFirms(client.user)).length>0;
 }catch{/* Keep the neutral loading state until the client can verify the session. */}
 if(firmOnly&&!bar)redirect('/client-reviews');
 return <AttorneyLogin initialSession={initialSession} introduction={<AttorneyBenefits/>}/>;
}
