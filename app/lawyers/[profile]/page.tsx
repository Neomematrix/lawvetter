import AttorneyChartBackLink from '../../AttorneyChartBackLink';
import {isActiveMembership} from '../../membership-status';
import {publicRecords} from '../../../db/public-records';
import {ensurePublicProfileIds} from '../../../db/public-profile-ids';
import {publicAttorneyColumns} from '../../../db/public-attorney';
import {cache} from 'react';
import {retryPublicRead} from '../../../db/public-read-cache';
import {siteOrigin} from '../../../db/site-settings';
import {publicProfileState,publicReviews} from '../../../db/public-directory';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound,permanentRedirect} from 'next/navigation';
import {rawDb} from '../../../db/raw';
import type {Attorney} from '../../GeorgiaDirectory';
import AttorneyProfile from '../../AttorneyProfile';
import SiteHeader from '../../SiteHeader';
import {attorneyPhoto} from '../../attorney-photo';
import {SITE_ORIGIN,attorneyPublicIdFromPath,attorneyBarFromPath,attorneyPath,isCanonicalAttorneyProfile,safeJsonLd} from '../../seo';

export const dynamic='force-dynamic';
type Props={params:Promise<{profile:string}>};

const findAttorney=cache(async function findAttorney(profile:string){
 const requestedPublicId=attorneyPublicIdFromPath(profile),bar=attorneyBarFromPath(profile);
 // Owner-confirmed duplicate: resolve to the retained record without restoring it.
 const publicId=requestedPublicId==='049544249fbe9537dbebabaa8580a40d'
  ?'02a8f83942e2b6fb0570bbff16cc48ee':requestedPublicId;
 if(!bar&&!publicId)return null;
 const attorney=await ensurePublicProfileIds(await retryPublicRead(()=>rawDb().prepare('SELECT '+publicAttorneyColumns('a')+',(SELECT photo_key FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS photo_key FROM attorneys a WHERE '+(publicId?'a.public_id':'a.bar_number')+'=? LIMIT 1').bind(publicId||bar).first<Attorney>()));
 return attorney&&isActiveMembership(attorney.status)?attorney:null;
});

function description(attorney:Attorney){
 const firm=attorney.company?` at ${attorney.company}`:'';
 return `Review ${attorney.name}'s ${attorney.state==='FL'?'Florida':attorney.state||'GA'} attorney record${firm}, including Bar status, admission details, location, and official record link.`.slice(0,160);
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const SITE_ORIGIN=await siteOrigin();
 const {profile}=await params,attorney=await publicRecords(await findAttorney(profile));
 if(!attorney)return {title:'Attorney profile not found',robots:{index:false,follow:false}};
 const canonical=SITE_ORIGIN+attorneyPath(attorney),summary=description(attorney),photo=attorneyPhoto(attorney.bar_number,attorney.photo_key);
 return {robots:{index:true,follow:true,googleBot:{index:true,follow:true}},title:`${attorney.name} — ${attorney.state==='FL'?'Florida':attorney.state==='GA'||!attorney.state?'Georgia':attorney.state} Attorney`,description:summary,alternates:{canonical},openGraph:{title:`${attorney.name} — ${attorney.state==='FL'?'Florida':attorney.state==='GA'||!attorney.state?'Georgia':attorney.state} Attorney | LawVetter`,description:summary,url:canonical,type:'profile',...(photo?{images:[{url:photo,alt:`${attorney.name}, ${attorney.state||'GA'} attorney`}]}:{images:[]})},twitter:{card:photo?'summary_large_image':'summary',title:`${attorney.name} — ${attorney.state==='FL'?'Florida':attorney.state==='GA'||!attorney.state?'Georgia':attorney.state} Attorney`,description:summary,...(photo?{images:[photo]}:{images:[]})}};
}

export default async function LawyerProfilePage({params}:Props){
 const SITE_ORIGIN=await siteOrigin();
 const {profile}=await params,attorney=await findAttorney(profile);
 if(!attorney)notFound();
 const canonicalPath=attorneyPath(attorney);
 if(!isCanonicalAttorneyProfile(profile,attorney))permanentRedirect(canonicalPath);
 const [profileState,reviews]=await Promise.all([publicProfileState(attorney.bar_number),publicReviews(attorney.bar_number)]);
 const publicAttorney=await publicRecords(attorney);
 const canonical=SITE_ORIGIN+canonicalPath,photo=attorneyPhoto(publicAttorney.bar_number,publicAttorney.photo_key);
 const person={'@context':'https://schema.org','@type':'Person','@id':canonical+'#person',name:attorney.name,jobTitle:attorney.employment_type||'Law Firm Attorney',url:canonical,...(photo?{image:new URL(photo,SITE_ORIGIN).toString()}:{}),...((attorney.employer_name||attorney.company)?{worksFor:{'@type':'Organization',name:attorney.employer_name||attorney.company}}:{}),...(attorney.city?{address:{'@type':'PostalAddress',addressLocality:attorney.city,addressRegion:attorney.state||'GA',addressCountry:'US'}}:{}),...(attorney.source_url?.startsWith('http')?{sameAs:[attorney.source_url]}:{})};
 const breadcrumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'LawVetter',item:SITE_ORIGIN},{'@type':'ListItem',position:2,name:'Find a lawyer',item:SITE_ORIGIN+'/discover'},{'@type':'ListItem',position:3,name:attorney.name,item:canonical}]};
 return <main><SiteHeader/><div className="page-shell lawyer-profile-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd([person,breadcrumbs])}}/><nav className="seo-breadcrumbs" aria-label="Breadcrumb"><Link href="/">LawVetter</Link><span aria-hidden="true">›</span><AttorneyChartBackLink/><span aria-hidden="true">›</span><span>{attorney.name}</span></nav><AttorneyProfile attorney={publicAttorney} headingLevel="h1" initialProfileState={profileState} initialReviews={reviews}/></div></main>;
}
