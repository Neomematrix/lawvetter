import {siteOrigin,publicSettings} from '../../db/site-settings';
import type {Metadata} from 'next';
import SiteHeader from '../SiteHeader';
import './disclaimer.css';

export async function generateMetadata():Promise<Metadata>{const settings=await publicSettings(),SITE_ORIGIN=settings.origin;return {
 title:'Disclaimer & Terms of Use',
 description:'Important information about LawVetter, attorney directory data, client reviews, rankings, and permitted use of site content.',
 alternates:{canonical:SITE_ORIGIN+'/disclaimer'},
};}

export default function DisclaimerPage(){
 return <main><SiteHeader/><article className="page-shell disclaimer-split">
  <header className="disclaimer-heading">
  <div>
  <p className="section-kicker">LEGAL INFORMATION</p>
  <h1>Disclaimer &amp; terms of use</h1>
  </div>
  <p className="legal-document-intro">Important information about what LawVetter provides, how directory and review information should be used, and the limits on reuse of LawVetter content.</p>
  </header>
  <div className="disclaimer-body">
  <nav className="disclaimer-index" aria-label="Disclaimer sections">
   <a href="#independent-platform">Independent information platform</a>
   <a href="#directory-information">Directory information</a>
   <a href="#profile-photo-removal">Information removal and account deletion</a>
   <a href="#reviews-verification">Reviews and verification</a>
   <a href="#rankings-decisions">Rankings and decisions</a>
   <a href="#content-use">Content use notice</a>
  </nav>
  <div className="disclaimer-sections">
   <section id="independent-platform" aria-labelledby="platform-heading">
    <h2 id="platform-heading">Independent information platform</h2>
    <p>LawVetter is an independent information and review platform. LawVetter is not a law firm and does not provide legal advice. Using this site does not create an attorney client relationship with LawVetter or any attorney or firm shown on the site.</p>
   </section>
   <section id="directory-information" aria-labelledby="directory-heading">
    <h2 id="directory-heading">Directory information</h2>
    <p>Attorney profiles may be created using publicly available professional information. Unless expressly indicated, the attorney has not claimed, verified, or endorsed their profile. Attorneys may request corrections or claim their profiles.</p>
    <p>Attorney, firm, licensing status, ranking, and directory information may come from public sources, third parties, and user submissions. It may be incomplete, inaccurate, delayed, or change without notice. Always verify current information directly with the applicable state licensing authority and the attorney or firm.</p>
   </section>
   <section id="profile-photo-removal" aria-labelledby="removal-heading">
    <h2 id="removal-heading">Information removal and account deletion</h2>
    <p>To request removal of your email address, bar number, photograph, or public profile, use our <a href="/contact">contact page</a>. Include your name, profile link, and the information you want removed. You do not need to create an account. We may ask you to verify your identity or authority.</p>
    <p>To delete your account, log in and choose <a href="/account/delete">Delete my account</a> from your dashboard. If you own a claimed attorney profile, deleting your account also deletes that public profile and its associated reviews. Account deletion is permanent. See our <a href="/privacy#account-removal">privacy notice</a> for details.</p>
   </section>
   <section id="reviews-verification" aria-labelledby="reviews-heading">
    <h2 id="reviews-heading">Reviews and verification</h2>
    <p>Client reviews are the opinions of individual users and do not reflect LawVetter&rsquo;s views. Verification confirms only that LawVetter reviewed evidence of a client relationship. It does not establish that every statement in a review is true, accurate, or complete.</p>
   </section>
   <section id="rankings-decisions" aria-labelledby="rankings-heading">
    <h2 id="rankings-heading">Rankings and decisions</h2>
    <p>Rankings, profile placement, and client reviews are not endorsements or guarantees. To the fullest extent permitted by law, LawVetter is not responsible for decisions made in reliance on directory information or content submitted by users.</p>
   </section>
   <section id="content-use" aria-labelledby="content-heading">
    <h2 id="content-heading">Content use notice</h2>
    <p>Except as permitted by applicable law or expressly authorized in writing by LawVetter, users may not scrape, reproduce, republish, redistribute, sell, license, or commercially exploit LawVetter content or directory data. This includes profiles, biographies, reviews, ratings, photos, badges, Q&amp;A content, rankings, and bulk contact lists.</p>
    <p>Automated collection that burdens, bypasses, or interferes with the site is prohibited.</p>
   </section>
  </div>
  </div>
  <a className="disclaimer-back" href="/">Back to LawVetter</a>
 </article></main>;
}
