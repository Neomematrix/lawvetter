import {displayBarNumber} from '../../attorney-identity';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {rawDb} from '../../../db/raw';
import type {Attorney} from '../../GeorgiaDirectory';
import AttorneyProfile from '../../AttorneyProfile';
import SiteHeader from '../../SiteHeader';
import {attorneyPhoto} from '../../attorney-photo';
import {SITE_ORIGIN,attorneyBarFromPath,attorneyPath,safeJsonLd} from '../../seo';

export const dynamic='force-dynamic';
type Props={params:Promise<{profile:string}>};

async function findAttorney(profile:string){
 const bar=attorneyBarFromPath(profile);
 if(!bar)return null;
 return rawDb().prepare('SELECT * FROM attorneys WHERE bar_number=? LIMIT 1').bind(bar).first<Attorney>();
}

function description(attorney:Attorney){
 const firm=attorney.company?` at ${attorney.company}`:'';
 return `Review ${attorney.name}'s ${attorney.state==='FL'?'Florida':attorney.state||'GA'} attorney record${firm}, including Bar status, admission details, location, and official record link.`.slice(0,160);
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {profile}=await params,attorney=await findAttorney(profile);
 if(!attorney)return {title:'Attorney profile not found',robots:{index:false,follow:false}};
 const canonical=SITE_ORIGIN+attorneyPath(attorney),summary=description(attorney),photo=attorneyPhoto(attorney.bar_number,attorney.photo_key);
 return {title:`${attorney.name} — ${attorney.state==='FL'?'Florida':attorney.state==='GA'||!attorney.state?'Georgia':attorney.state} Attorney`,description:summary,alternates:{canonical},openGraph:{title:`${attorney.name} — ${attorney.state==='FL'?'Florida':attorney.state==='GA'||!attorney.state?'Georgia':attorney.state} Attorney | LawVetter`,description:summary,url:canonical,type:'profile',...(photo?{images:[{url:photo,alt:`${attorney.name}, ${attorney.state||'GA'} attorney`}]}:{images:[]})},twitter:{card:photo?'summary_large_image':'summary',title:`${attorney.name} — ${attorney.state==='FL'?'Florida':attorney.state==='GA'||!attorney.state?'Georgia':attorney.state} Attorney`,description:summary,...(photo?{images:[photo]}:{images:[]})}};
}

export default async function LawyerProfilePage({params}:Props){
 const {profile}=await params,attorney=await findAttorney(profile);
 if(!attorney)notFound();
 const canonicalPath=attorneyPath(attorney);
 if('/lawyers/'+profile!==canonicalPath)redirect(canonicalPath);
 const canonical=SITE_ORIGIN+canonicalPath,photo=attorneyPhoto(attorney.bar_number,attorney.photo_key);
 const person={'@context':'https://schema.org','@type':'Person','@id':canonical+'#person',name:attorney.name,jobTitle:'Attorney',identifier:`${attorney.state||'GA'} Bar ${displayBarNumber(attorney.bar_number)}`,url:canonical,...(photo?{image:new URL(photo,SITE_ORIGIN).toString()}:{}),...(attorney.company?{worksFor:{'@type':'Organization',name:attorney.company}}:{}),...(attorney.city?{address:{'@type':'PostalAddress',addressLocality:attorney.city,addressRegion:attorney.state||'GA',addressCountry:'US'}}:{}),...(attorney.source_url?.startsWith('http')?{sameAs:[attorney.source_url]}:{})};
 const breadcrumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'LawVetter',item:SITE_ORIGIN},{'@type':'ListItem',position:2,name:'Find a lawyer',item:SITE_ORIGIN+'/find-a-lawyer'},{'@type':'ListItem',position:3,name:attorney.name,item:canonical}]};
 return <main><SiteHeader/><div className="page-shell lawyer-profile-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd([person,breadcrumbs])}}/><nav className="seo-breadcrumbs" aria-label="Breadcrumb"><Link href="/">LawVetter</Link><span aria-hidden="true">›</span><Link href="/find-a-lawyer">Find a lawyer</Link><span aria-hidden="true">›</span><span>{attorney.name}</span></nav><AttorneyProfile attorney={attorney} headingLevel="h1"/></div></main>;
}
