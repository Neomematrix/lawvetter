import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import SiteHeader from '../../SiteHeader';
import {practiceGuides} from '../../practice-guides';
import {SITE_ORIGIN,safeJsonLd} from '../../seo';

type Props={params:Promise<{slug:string}>};
export const dynamicParams=false;
export function generateStaticParams(){return Object.keys(practiceGuides).map(slug=>({slug}));}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params,guide=practiceGuides[slug];
 if(!guide)return {title:'Practice area not found',robots:{index:false,follow:false}};
 const title=`Find a ${guide.name} lawyer in Georgia`;
 const canonical=SITE_ORIGIN+'/practice-areas/'+slug;
 return {title,description:guide.description,alternates:{canonical},openGraph:{title:title+' | LawVetter',description:guide.description,url:canonical,type:'website'}};
}

export default async function PracticeAreaPage({params}:Props){
 const {slug}=await params,guide=practiceGuides[slug];
 if(!guide)notFound();
 const canonical=SITE_ORIGIN+'/practice-areas/'+slug;
 const structured={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'LawVetter',item:SITE_ORIGIN},{'@type':'ListItem',position:2,name:'Find a lawyer',item:SITE_ORIGIN+'/find-a-lawyer'},{'@type':'ListItem',position:3,name:guide.name,item:canonical}]};
 return <main><SiteHeader/><article className="page-shell seo-guide">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(structured)}}/>
  <nav className="seo-breadcrumbs" aria-label="Breadcrumb"><Link href="/">LawVetter</Link><span aria-hidden="true">›</span><Link href="/find-a-lawyer">Find a lawyer</Link><span aria-hidden="true">›</span><span>{guide.name}</span></nav>
  <header className="seo-guide-hero"><p className="section-kicker">GEORGIA LAWYER DIRECTORY</p><h1>Find a {guide.name.toLowerCase()} lawyer in Georgia</h1><p>{guide.intro}</p><div className="seo-guide-actions"><Link className="gold-button" href="/#attorney-search">Search Georgia lawyers</Link><Link className="outline-button" href="/hire-lawyer">Request help finding a lawyer</Link></div></header>
  <div className="seo-guide-grid"><section><h2>Matters a {guide.name.toLowerCase()} lawyer may handle</h2><ul>{guide.matters.map(item=><li key={item}>{item}</li>)}</ul></section><section><h2>Questions to ask before you hire</h2><ul>{guide.questions.map(item=><li key={item}>{item}</li>)}</ul></section></div>
  <section className="seo-guide-checklist"><h2>How to compare lawyers on LawVetter</h2><ol><li><strong>Check the professional record.</strong> Review current membership status, admission date, location, and the linked official State Bar record.</li><li><strong>Look for relevant experience.</strong> Ask how often the lawyer handles matters with facts, courts, agencies, and deadlines like yours.</li><li><strong>Understand the working relationship.</strong> Confirm who will handle the matter, how updates work, and how fees and costs are calculated.</li></ol></section>
  <aside className="seo-guide-note"><h2>Important information</h2><p>{guide.note}</p><p>LawVetter is an independent information platform, not a law firm. Directory listings, search rankings, and client reviews are not endorsements or guarantees.</p></aside>
  <section className="seo-related"><h2>Explore other practice areas</h2><div>{Object.entries(practiceGuides).filter(([id])=>id!==slug).map(([id,item])=><Link key={id} href={'/practice-areas/'+id}>{item.name}</Link>)}</div></section>
 </article></main>;
}

