import {publicSettings} from '../../db/site-settings';
import type {Metadata} from 'next';
import SiteHeader from '../SiteHeader';
import '../disclaimer/disclaimer.css';

export async function generateMetadata():Promise<Metadata>{const settings=await publicSettings(),SITE_ORIGIN=settings.origin;return {title:'Privacy notice',description:'How LawVetter uses account information, form submissions, browser analytics, and human verification.',alternates:{canonical:SITE_ORIGIN+'/privacy'}};}

export default function Privacy(){return <main><SiteHeader/><article className="page-shell disclaimer-split">
 <header className="disclaimer-heading">
  <div><p className="section-kicker">YOUR INFORMATION</p><h1>Privacy notice</h1></div>
  <p className="legal-document-intro">How LawVetter uses account information, form submissions, browser analytics, and human verification.</p>
 </header>
 <div className="disclaimer-body">
  <nav className="disclaimer-index" aria-label="Privacy notice sections">
   <a href="#accounts-submissions">Accounts and submissions</a>
   <a href="#account-removal">Information removal and account deletion</a>
   <a href="#human-verification">Human verification</a>
   <a href="#visits-notifications">Visits and notifications</a>
  </nav>
  <div className="disclaimer-sections">
   <section id="accounts-submissions" aria-labelledby="accounts-heading">
    <h2 id="accounts-heading">Accounts and submissions</h2>
    <p>LawVetter stores the information you provide to create an account, manage a profile, submit a listing, request legal help, or verify a client relationship. Administrators review submissions. Approved attorney and firm information and published reviews appear in the public directory.</p>
    <p>Contact inquiries and verification evidence are kept private for administration and review. Inquiry details may be shared with the attorney you request, as described in the form consent.</p>
   </section>
   <section id="account-removal" aria-labelledby="account-removal-heading">
    <h2 id="account-removal-heading">Information removal and account deletion</h2>
    <p>Request removal of an email address, bar number, photograph, or profile through our <a href="/contact">contact page</a>. Include your name, profile link, and what you want removed. An account is not required. We may request identity verification.</p>
    <p>Signed in users can choose <a href="/account/delete">Delete my account</a> in their dashboard. This permanently removes account details, login credentials, saved attorneys, verification requests, and reviews submitted by that account. All login sessions are revoked. Attorney profiles remain in the public directory, along with reviews from other clients. Any profile claims and editing access held by the deleted account are released.</p>
    <p>Private inquiry and submission records, uploaded files, and limited administration records may remain for handling requests and maintaining directory records. Contact us if you also want these records reviewed for removal. Copies held by search engines or other websites are outside LawVetter’s control.</p>
   </section>
   <section id="human-verification" aria-labelledby="verification-heading">
    <h2 id="verification-heading">Human verification</h2>
    <p>We use Cloudflare Turnstile to help protect forms from automated submissions. Turnstile may run in the background and process technical signals such as your IP address, browser information, and the site origin.</p>
    <p>Read <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noopener noreferrer">Cloudflare’s Turnstile Privacy Addendum</a> and <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare’s Privacy Policy</a> for details.</p>
   </section>
   <section id="visits-notifications" aria-labelledby="visits-heading">
    <h2 id="visits-heading">Visits and notifications</h2>
    <p>LawVetter uses a monthly browser identifier to measure visits and inquiry rates. We also measure public page visits, button and link clicks, scrolling depth, directory searches, search filters, and result counts through Google Analytics. Search terms that appear to contain contact information or personal details are redacted. Passwords, private account pages, contact details, and inquiry messages are not included in our analytics events. Browser Do Not Track and Global Privacy Control preferences are respected. Account, inquiry, and review notifications may be sent through our email provider.</p>
   </section>
  </div>
 </div>
 <a className="disclaimer-back" href="/">Back to LawVetter</a>
</article></main>;}
