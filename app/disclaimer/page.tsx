import type {Metadata} from 'next';
import SiteHeader from '../SiteHeader';

export const metadata:Metadata={
 title:'Disclaimer & Content Use',
 description:'Important information about LawVetter, attorney-directory data, client reviews, rankings, and permitted use of site content.',
 alternates:{canonical:'https://lawvetter.kyle-george-1801.chatgpt.site/disclaimer'},
};

export default function DisclaimerPage(){
 return <main><SiteHeader/><article className="page-shell legal-document">
  <p className="section-kicker">LEGAL INFORMATION</p>
  <h1>Disclaimer &amp; content-use terms</h1>
  <p className="legal-document-intro">Important information about what LawVetter provides, how directory and review information should be used, and the limits on reuse of LawVetter content.</p>
  <div className="legal-document-sections">
   <section>
    <h2>Independent information platform</h2>
    <p>LawVetter is an independent information and review platform. LawVetter is not a law firm and does not provide legal advice. Using this site does not create an attorney-client relationship with LawVetter or any attorney or firm shown on the site.</p>
   </section>
   <section>
    <h2>Directory information</h2>
    <p>Attorney, firm, licensing-status, ranking, and directory information may come from public, third-party, and user-submitted sources. It may be incomplete, inaccurate, delayed, or change without notice. Always verify current information directly with the applicable state licensing authority and the attorney or firm.</p>
   </section>
   <section>
    <h2>Reviews and verification</h2>
    <p>Client reviews are the opinions of individual users and do not reflect LawVetter&rsquo;s views. Verification confirms only that LawVetter reviewed evidence of a client relationship. It does not establish that every statement in a review is true, accurate, or complete.</p>
   </section>
   <section>
    <h2>Rankings and decisions</h2>
    <p>Rankings, profile placement, and client reviews are not endorsements or guarantees. To the fullest extent permitted by law, LawVetter is not responsible for decisions made in reliance on directory information or user-submitted content.</p>
   </section>
   <section>
    <h2>Content-use notice</h2>
    <p>Except as permitted by applicable law or expressly authorized in writing by LawVetter, users may not scrape, reproduce, republish, redistribute, sell, license, or commercially exploit LawVetter content or directory data. This includes profiles, biographies, reviews, ratings, photos, badges, Q&amp;A content, rankings, and bulk contact lists.</p>
    <p>Automated collection that burdens, bypasses, or interferes with the site is prohibited.</p>
   </section>
  </div>
  <a className="legal-document-back" href="/">Back to LawVetter</a>
 </article></main>;
}
