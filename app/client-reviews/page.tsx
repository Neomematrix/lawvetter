import {resolveAttorneyReference} from '../../db/attorney-reference';
import {publicRecords} from '../../db/public-records';
import {rawDb} from '../../db/raw';
import {isJudicialProfile} from '../../db/judicial-profile';
import {siteOrigin,publicSettings} from '../../db/site-settings';
import {validAttorneyId} from '../attorney-identity';
import SiteHeader from '../SiteHeader';
import ClientAccountGate from './ClientAccountGate';
import type {Metadata} from 'next';
import {SITE_ORIGIN} from '../seo';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{const settings=await publicSettings(),SITE_ORIGIN=settings.origin;return {robots:{index:true,follow:true},title:'Verified Lawyer Reviews | LawVetter',description:'Find lawyers, compare attorney profiles, and read verified client reviews. Share your experience and help others hire right with LawVetter.',alternates:{canonical:SITE_ORIGIN+'/client-reviews'}};}
export default async function Page({searchParams}:{searchParams:Promise<{bar?:string}>}){const p=await searchParams;const internal=await resolveAttorneyReference(p.bar||'');if(internal&&await rawDb().prepare('SELECT bar_number FROM attorneys WHERE bar_number=?').bind(internal).first()){const ref=await publicRecords({bar_number:internal});p.bar=ref.bar_number;}else p.bar='';if(validAttorneyId(p.bar||'')&&await isJudicialProfile(rawDb(),internal))return <main><SiteHeader/><section className="section"><h1>Judicial profile</h1><p>Client reviews are not available for judges.</p><a href={'/attorney?bar='+encodeURIComponent(p.bar!)}>View judicial profile</a></section></main>;return <main><SiteHeader/><ClientAccountGate integratedIntro bar={validAttorneyId(p.bar||'')?p.bar!:''}/></main>;}
