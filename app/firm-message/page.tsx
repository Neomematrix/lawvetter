import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import SiteHeader from '../SiteHeader';
import {FirmMessageForm} from '../FirmContact';
import {publicDirectory} from '../../db/public-directory';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Message a firm',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{firm?:string|string[]}>}){
 const params=await searchParams;
 const name=typeof params.firm==='string'?params.firm.trim().slice(0,200):'';
 if(!name)notFound();
 let firm:{name:string};
 try{({firm}=await publicDirectory<{firm:{name:string}}>({firm:name,page:1}));}
 catch(error){if((error as {status?:number}).status===404)notFound();throw error;}
 return <main><SiteHeader/><div className="page-shell account-page"><a className="firm-back" href={'/firm?name='+encodeURIComponent(firm.name)}>Back to firm</a><FirmMessageForm name={firm.name}/></div></main>;
}
