import {readDeadline} from './read-json';
import {publicDiscoveryData} from '../db/public-discovery';
import {siteOrigin,publicSettings} from '../db/site-settings';
import type {Metadata} from 'next';
import type {DiscoveryData,View} from './Discovery';
import HomeClient from './HomeClient';
import HeroMonthlySpotlight from './HeroMonthlySpotlight';
import {DiscoveryHome} from './DiscoveryHome';
import {Charts} from './Charts';
import {ShortlistPage} from './ShortlistPage';
import {rawDb} from '../db/raw';
import {SITE_DESCRIPTION,SITE_ORIGIN} from './seo';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{const settings=await publicSettings(),SITE_ORIGIN=settings.origin;return {title:{absolute:'LawVetter | Find Lawyers & Read Client Reviews'},description:SITE_DESCRIPTION,alternates:{canonical:SITE_ORIGIN+'/'}};}
export default async function Home({searchParams}:{searchParams:Promise<{view?:string}>}){
 const {view}=await searchParams;
 const initialView:View=view==='charts'?'charts':view==='shortlist'?'shortlist':'discover';
 // Start public data now, but stream the header, hero and search without waiting
 // for ranking queries. The data-dependent view has its own Suspense boundary.
 const initialHome=(async()=>{try{return await readDeadline(publicDiscoveryData(rawDb()),15000) as unknown as DiscoveryData;}catch(error){console.error('Initial discovery unavailable',error);return null;}})();
 const initialContent=initialView==='charts'?Charts:initialView==='shortlist'?ShortlistPage:DiscoveryHome;
 // Preload the exact bold faces used on each landing view, rather than
 // waiting for the shared stylesheet to discover them. /discover is unchanged.
 return <>{initialView!=='shortlist'&&<link rel="preload" href="/fonts/lato.7a7ce1a34f3e.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/>}{initialView==='discover'&&<link rel="preload" href="/fonts/lato.bd9a6192274f.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/>}<HomeClient initialHero={initialView==='discover'?HeroMonthlySpotlight:undefined} initialHome={initialHome} initialContent={initialContent} initialView={initialView}/></>;
}
