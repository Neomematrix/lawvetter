import {publicRecords} from '../../db/public-records';
import {resolveAttorneyReference} from '../../db/attorney-reference';
import {siteOrigin,publicSettings} from '../../db/site-settings';
import {ownershipVerifiedColumn} from '../../db/attorney-verification';
import Intake from './Intake';
import type {Metadata} from 'next';
import {rawDb} from '../../db/raw';
import {SITE_ORIGIN} from '../seo';
export async function generateMetadata():Promise<Metadata>{const settings=await publicSettings(),SITE_ORIGIN=settings.origin;return {title:'Contact an Attorney',description:'Send LawVetter an inquiry about the legal help you need.',alternates:{canonical:SITE_ORIGIN+'/hire-lawyer'}};}
export default async function Page({searchParams}:{searchParams:Promise<{attorney?:string}>}){const {attorney}=await searchParams;if(!attorney)return <Intake/>;let row:{name:string;bar_number:string;ownership_verified:number}|null=null;try{row=await rawDb().prepare('SELECT name,bar_number,'+ownershipVerifiedColumn()+' FROM attorneys WHERE bar_number=?').bind(await resolveAttorneyReference(attorney)).first<{name:string;bar_number:string;ownership_verified:number}>();}catch{return <main className="page-shell"><h1>Unable to load this attorney</h1><p>Please reload and try again. No inquiry has been submitted.</p></main>;}if(!row)return <main className="page-shell"><h1>Attorney not found</h1><a href="/">Search the directory</a></main>;row=await publicRecords(row);return <Intake attorney={{bar:row.bar_number,name:row.name,verified:row.ownership_verified===1}}/>;}
