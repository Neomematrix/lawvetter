import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import SiteHeader from '../../SiteHeader';
import {FirmMessageForm} from '../../FirmContact';
import {firmRecord} from '../../../db/firm-access';
import {firmKey} from '../../api/attorneys/firm';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Contact a firm',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{firm?:string|string[]}>}) {
 const params=await searchParams;
 const name=typeof params.firm==='string'?params.firm.trim().slice(0,200):'';
 if(!name)notFound();
 const firm=await firmRecord(firmKey(name));
 if(!firm)notFound();
 return <main><SiteHeader/><div className="page-shell account-page"><a className="firm-back" href={'/firm?name='+encodeURIComponent(firm.name)}>Back to firm</a><FirmMessageForm name={firm.name}/></div></main>;
}
