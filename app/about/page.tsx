import type {Metadata} from 'next';
import Link from 'next/link';
import SiteHeader from '../SiteHeader';
import {siteOrigin} from '../../db/site-settings';
import {SITE_DESCRIPTION,safeJsonLd} from '../seo';

export async function generateMetadata():Promise<Metadata>{
 const origin=await siteOrigin();
 return {title:{absolute:'About | LawVetter'},description:SITE_DESCRIPTION,alternates:{canonical:origin+'/about'},openGraph:{title:'About | LawVetter',description:SITE_DESCRIPTION,url:origin+'/about',type:'website'}};
}

export default async function AboutPage(){
 const origin=await siteOrigin();
 const structured={'@context':'https://schema.org','@type':'AboutPage','@id':origin+'/about#page',url:origin+'/about',name:'About LawVetter',description:SITE_DESCRIPTION,about:{'@id':origin+'/#organization'},isPartOf:{'@id':origin+'/#website'}};
 return <main><SiteHeader/><article className="page-shell seo-guide about-lawvetter-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(structured)}}/>
  <nav className="seo-breadcrumbs" aria-label="Breadcrumb"><a href="/">LawVetter</a><span aria-hidden="true">›</span><span>About</span></nav>
  <header className="seo-guide-hero about-intro-panel about-intro-with-art"><div className="about-intro-content"><div className="about-intro-copy"><p className="section-kicker">HIRE RIGHT, WITH LAWVETTER</p><h1>About</h1><p>LawVetter is a lawyer directory and verified client review platform. Find lawyers by location or practice area, compare attorney profiles, and read client experiences before deciding whom to contact.</p></div><div className="seo-guide-actions about-intro-actions"><Link className="gold-button" href="/discover">Find a lawyer</Link><a className="outline-button" href="/find-a-lawyer#lawyer-search-questions">How LawVetter works</a></div></div><figure className="about-intro-art"><img src="/brand/about-attorney-profiles.webp" alt="Illustrated attorney profiles with a magnifying glass for comparing lawyers" width="900" height="600" fetchPriority="high" decoding="async"/></figure></header>
  <section><h2>What LawVetter helps you do</h2><ul><li>Search for an attorney by name, law firm, location, or legal need.</li><li>Compare professional profiles and follow links to official State Bar records.</li><li>Read available verified client reviews and save attorneys to a shortlist.</li><li>Share your own experience after your client relationship has been verified.</li></ul></section>
  <section><h2>What a verified client review means</h2><p>Before a lawyer review can be published, LawVetter checks court records to verify the client and attorney relationship. This check supports the relationship behind the review. It does not verify every statement in the review or guarantee an attorney’s performance.</p><p>Verified clients can publish with their name or as an anonymous verified client. Both options require verification. Case numbers, court details, email addresses, and verification evidence are not added to the public review. A review’s wording may still identify its author to someone familiar with the case.</p></section>
  <section><h2>Research before you hire</h2><p>Directory coverage and review availability vary. A missing profile or review does not establish a lawyer’s qualifications. Check current licensing with the applicable State Bar and ask the attorney directly about experience, availability, communication, and fees.</p><p>LawVetter is an independent information platform, not a law firm. Using LawVetter does not create an attorney-client relationship.</p></section>
  <section><h2>Official LawVetter information</h2><div className="about-official-links"><a className="about-website-link" href={origin}>LAWVETTER</a><a className="about-linkedin-link" href="https://www.linkedin.com/company/law-vetter/" target="_blank" rel="noopener noreferrer" aria-label="LawVetter on LinkedIn (opens in a new tab)" title="LawVetter on LinkedIn"><img src="/linkedin.svg" alt="LinkedIn" width="28" height="28"/></a></div></section>
 </article></main>;
}
