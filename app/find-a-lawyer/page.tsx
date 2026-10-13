import type {Metadata} from 'next';
import Link from 'next/link';
import SiteHeader from '../SiteHeader';
import {practiceGuides} from '../practice-guides';
import {SITE_ORIGIN,safeJsonLd} from '../seo';

export const metadata:Metadata={title:'Find a Lawyer in Georgia',description:'Search Georgia lawyers, review professional records, compare relevant experience, and prepare practical questions before contacting an attorney.',alternates:{canonical:SITE_ORIGIN+'/find-a-lawyer'}};

export default function FindALawyerPage(){
 const structured={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'LawVetter',item:SITE_ORIGIN},{'@type':'ListItem',position:2,name:'Find a lawyer in Georgia',item:SITE_ORIGIN+'/find-a-lawyer'}]};
 return <main><SiteHeader/><article className="page-shell seo-guide">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(structured)}}/>
  <nav className="seo-breadcrumbs" aria-label="Breadcrumb"><Link href="/">LawVetter</Link><span aria-hidden="true">›</span><span>Find a lawyer</span></nav>
  <header className="seo-guide-hero"><p className="section-kicker">A PRACTICAL STARTING POINT</p><h1>Find a lawyer in Georgia</h1><p>Start with the legal issue, location, and type of help you need. Then compare professional records, published practice information, client experiences, communication, and fees before deciding whom to contact.</p><div className="seo-guide-actions"><Link className="gold-button" href="/#attorney-search">Search the Georgia lawyer directory</Link><Link className="outline-button" href="/client-reviews">Read verified client reviews</Link></div></header>
  <section className="seo-guide-checklist"><h2>A careful way to choose a lawyer</h2><ol><li><strong>Describe the problem clearly.</strong> Write down the important dates, people, documents, court or agency information, and the outcome you are seeking.</li><li><strong>Verify the professional record.</strong> Check current licensing status through the official State Bar record linked on each LawVetter profile.</li><li><strong>Compare relevant experience.</strong> Ask whether the lawyer has handled similar facts, courts, agencies, or transactions.</li><li><strong>Discuss service and cost.</strong> Confirm who will do the work, how you will receive updates, and how legal fees and other expenses are calculated.</li></ol></section>
  <section><div className="section-heading"><div><p className="section-kicker">BROWSE BY LEGAL NEED</p><h2>Georgia lawyer practice-area guides</h2></div></div><p className="section-description">These guides explain common matters and useful consultation questions. They are general information, not legal advice.</p><div className="seo-practice-links">{Object.entries(practiceGuides).map(([id,guide])=><Link key={id} href={'/practice-areas/'+id}><strong>{guide.name}</strong><span>{guide.description}</span></Link>)}</div></section>
  <div className="seo-guide-grid"><section><h2>What LawVetter can help you compare</h2><ul><li>Georgia Bar number and current membership status</li><li>Admission date, location, law school, and listed firm</li><li>Published practice information and claimed-profile details</li><li>Verified client experiences and official record links</li></ul></section><section><h2>What to confirm directly</h2><ul><li>Experience with your particular kind of matter</li><li>Availability, conflicts, deadlines, and likely next steps</li><li>Who will handle the work and communicate with you</li><li>Fees, retainers, case costs, and billing arrangements</li></ul></section></div>
  <aside className="seo-guide-note"><h2>LawVetter is a research tool</h2><p>LawVetter is not a law firm and does not provide legal advice. Listings, reviews, and popularity rankings are not endorsements or guarantees. Verify current information with the State Bar and the lawyer before making a decision.</p></aside>
 </article></main>;
}
