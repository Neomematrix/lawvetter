import {resolveAttorneyReference} from '../../db/attorney-reference';
import {ensurePublicProfileIds} from '../../db/public-profile-ids';
import {validAttorneyId} from '../attorney-identity';
import SingleAttorney from './SingleAttorney';
import type {Metadata} from 'next';
import {permanentRedirect} from 'next/navigation';
import {rawDb} from '../../db/raw';
import type {Attorney} from '../GeorgiaDirectory';
import {attorneyPath} from '../seo';

export const metadata:Metadata={title:'Attorney profile',robots:{index:false,follow:true}};
export const dynamic='force-dynamic';

export default async function Page({searchParams}:{searchParams:Promise<{bar?:string|string[];state?:string}>}){
 const p=await searchParams,bar=typeof p.bar==='string'?await resolveAttorneyReference(p.bar):'';
 let attorney:Attorney|null=null;
 if(validAttorneyId(bar)){try{attorney=await rawDb().prepare(p.state?'SELECT * FROM attorneys WHERE state=? AND COALESCE(license_number,bar_number)=? LIMIT 1':'SELECT * FROM attorneys WHERE bar_number=? LIMIT 1').bind(...(p.state?[p.state,bar]:[bar])).first<Attorney>();}catch{}}
 if(attorney)permanentRedirect(attorneyPath(await ensurePublicProfileIds(attorney)));
 return <SingleAttorney bar={typeof p.bar==='string'?p.bar:''}/>;
}
