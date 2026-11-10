import {cache} from 'react';
import {readDeadline} from '../../read-json';
import {practiceAreaChoices} from '../../practice-category';
import '../../practice-city-browser.css';
import {localDirectory} from '../../../db/local-directory';
import {practiceBannerImage} from '../../practice-banner';
import {searchRadius} from '../../search-radius';
import {siteOrigin} from '../../../db/site-settings';
import {publicDirectory} from '../../../db/public-directory';
import type {PracticeQuery,PracticeResults} from '../../PracticeDirectory';
import {practiceIcon} from '../../practice-icons';
import {practiceCatalog} from '../../../db/practice-categories';
import {rawDb} from '../../../db/raw';
import PracticeDirectory from '../../PracticeDirectory';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound,permanentRedirect} from 'next/navigation';
import {practiceCategoryId} from '../../practice-category';
import SiteHeader from '../../SiteHeader';
import {practiceGuides} from '../../practice-guides';
import {SITE_ORIGIN,safeJsonLd} from '../../seo';

const pageCatalog=cache(async()=>{
 try{return await practiceCatalog(rawDb());}
 catch(error){console.error('Practice page catalog unavailable',error);return {areas:practiceAreaChoices(),unavailable:true};}
});
type Props={params:Promise<{slug:string}>;searchParams?:Promise<{q?:string;city?:string;zip?:string;radius?:string;page?:string}>};
export const dynamic='force-dynamic';
export const dynamicParams=true;
export function generateStaticParams(){return Object.keys(practiceGuides).map(slug=>({slug}));}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const SITE_ORIGIN=await siteOrigin();
 const {slug}=await params,area=(await pageCatalog()).areas.find(a=>a.id===practiceCategoryId(slug));
 if(!area)return {title:'Practice area not found',robots:{index:false,follow:false}};
 const title=area.id==='judge'?'Find Judges':`Find ${area.name} Attorneys`;
 const canonical=SITE_ORIGIN+'/practice-areas/'+area.id;
 return {title,description:area.description,alternates:{canonical},openGraph:{title:title+' | LawVetter',description:area.description,url:canonical,type:'website'}};
}

export default async function PracticeAreaPage({params,searchParams}:Props){
 const SITE_ORIGIN=await siteOrigin();
 const {slug}=await params;
 if(practiceCategoryId(slug)!==slug)permanentRedirect('/practice-areas/'+practiceCategoryId(slug));
 const guide=practiceGuides[slug],catalog=await pageCatalog(),area=catalog.areas.find(a=>a.id===slug);
 if(!area){if('unavailable' in catalog)throw new Error('Practice categories temporarily unavailable. Please retry.');notFound();}
 const isJudge=area.id==='judge',categoryName=isJudge?'Judges':area.name;
 const filters=await searchParams||{},query:PracticeQuery={q:(filters.q||'').slice(0,150),city:(filters.city||'').slice(0,100),zip:(filters.zip||'').slice(0,10),...(filters.zip?{radius:searchRadius(filters.radius)}:{}),page:Math.max(1,Math.min(10000,Number.parseInt(filters.page||'1')||1))};
 let initialResult:PracticeResults|undefined,initialError='';
 try{initialResult=await readDeadline(publicDirectory<PracticeResults>({practice:area.id,...query,statusGroup:'all'}),5000);}catch(error){if((error as {status?:number}).status===400){initialResult={attorneys:[],total:0};initialError=error instanceof Error?error.message:'Check your search filters.';}else console.error('Practice results deferred to browser',error);}
 const canonical=SITE_ORIGIN+'/practice-areas/'+slug;
 const {markets}=await readDeadline(localDirectory(),1500).catch(error=>{console.warn('Optional practice cities unavailable',error);return {markets:[]};});
 const cityMarkets=markets.filter(m=>m.practices.includes(area.id));
 const structured={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'LawVetter',item:SITE_ORIGIN},{'@type':'ListItem',position:2,name:'Find a lawyer',item:SITE_ORIGIN+'/discover'},{'@type':'ListItem',position:3,name:categoryName,item:canonical}]};
 return <main><SiteHeader/><article className="page-shell discovery-shell seo-guide practice-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(structured)}}/>
  <nav className="seo-breadcrumbs" aria-label="Breadcrumb"><Link href="/">LawVetter</Link><span aria-hidden="true">›</span><Link href="/discover">Find a lawyer</Link><span aria-hidden="true">›</span><span>{categoryName}</span></nav>
  <header className="seo-guide-hero practice-photo-hero"><img className="practice-banner-image" src={practiceBannerImage(area.id)} alt="" aria-hidden="true" width="1800" height="1200" fetchPriority="high" decoding="async"/><div className="practice-banner-copy"><p className="section-kicker">{isJudge?'LAWVETTER JUDICIAL DIRECTORY':'LAWVETTER PRACTICE DIRECTORY'}</p><h1>{isJudge?'Judges':area.name+' attorneys'}</h1><p>{isJudge?'Explore judicial profiles. Search judges by name or location and view their professional records.':'Explore '+area.name.toLowerCase()+' attorneys. Search by name or location and compare their professional records.'}</p></div></header>
  <PracticeDirectory key={area.id} area={area} initialResult={initialResult} initialError={initialError} initialQuery={query}/>
  {cityMarkets.length>0&&<details className="practice-city-browser"><summary>Browse by city</summary><nav aria-label={area.name+" attorneys by city"}>{cityMarkets.map(m=><a key={m.id} href={"/lawyers-in/"+m.id+"/"+area.id}>{m.name}<span aria-hidden="true">→</span></a>)}</nav></details>}
  {guide&&<>
  <section className="practice-consultation" aria-labelledby="practice-consultation-title">
   <header className="practice-consultation-heading"><p className="section-kicker">PREPARE FOR YOUR FIRST CONVERSATION</p><h2 id="practice-consultation-title">What to ask a {guide.name.toLowerCase()} lawyer</h2><p>Start with the questions that matter to your situation. Bring them to your consultation.</p></header>
   <div className="practice-consultation-layout"><section className="practice-matters"><h3>Find help with</h3><ul>{guide.matters.map(item=><li key={item}>{item}</li>)}</ul><div className="practice-meeting-tip"><strong>Make your meeting count</strong><p>Bring relevant documents, a short timeline, and any upcoming deadlines.</p></div></section><ol className="practice-question-list">{guide.questions.map((item,index)=><li key={item}><span aria-hidden="true">{index+1}</span><p>{item}</p></li>)}</ol></div>
  </section>
  <section className="practice-compare"><header><p className="section-kicker">CHOOSE WITH CONFIDENCE</p><h2>Compare lawyers in three steps</h2></header><ol><li><span>1</span><h3>Check their record</h3><p>Review membership status, admission date, and the linked official State Bar record.</p></li><li><span>2</span><h3>Ask about experience</h3><p>Look for experience with situations, courts, and deadlines like yours.</p></li><li><span>3</span><h3>Discuss fees and updates</h3><p>Confirm who handles your case, how you receive updates, and what the work will cost.</p></li></ol></section>
  <aside className="practice-guide-disclosure"><strong>Before you decide</strong><p>{guide.note}</p><p>LawVetter is an independent information platform. Listings, rankings, and reviews do not guarantee results.</p></aside>
  </>}
  <section className="discovery-section practice-related"><h2>Explore other practice areas</h2><div className="practice-grid">{catalog.areas.filter(item=>item.id!==slug).map(item=><Link className="practice-tile" key={item.id} href={'/practice-areas/'+item.id}><strong>{item.name}</strong><span>{item.description}</span><b aria-hidden="true">{practiceIcon(item.id)&&<img className="practice-tile-icon" src={practiceIcon(item.id)} alt="" width={42} height={42} loading="lazy" decoding="async"/>}</b></Link>)}</div></section>
 </article></main>;
}

