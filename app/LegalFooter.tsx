'use client';
import {useShortlist} from './Shortlist';
export default function LegalFooter(){
 const shortlist=useShortlist();
 return <footer className="discovery-footer legal-footer">
  <div className="legal-footer-inner">
   <p className="legal-footer-tagline">Know who represents you.</p>
   <nav className="legal-footer-links" aria-label="Footer navigation">
    <a href="/">Discover</a>
    <a href="/about">About LawVetter</a>
    <a href="/awards">Monthly awards</a>
    <a href="/?view=charts">Rankings &amp; methodology</a>
    {shortlist.signedIn&&<a href="/?view=shortlist">Your shortlist</a>}
    <a href="/account">Claim your profile</a>
    <a href="/privacy">Privacy notice</a>
    <a href="/disclaimer">Disclaimer &amp; terms of use</a>
    <a href="/contact">Contact LawVetter</a>
   </nav>
   <p className="legal-footer-summary" role="note">LawVetter provides general information, not legal advice. <a href="/disclaimer">Read the full disclaimer and terms of use.</a></p>
   <p className="legal-footer-summary">Our directory is growing and does not include every attorney. A missing listing does not indicate licensing status or qualifications. We use a monthly browser identifier to measure visits and inquiry rates; contact details and inquiry messages are never included in our analytics events.</p><div className="legal-footer-bottom"><small>© 2026 LawVetter. All rights reserved.</small><a className="footer-linkedin" href="https://www.linkedin.com/company/law-vetter/" target="_blank" rel="noopener noreferrer" aria-label="LawVetter on LinkedIn (opens in a new tab)" title="LawVetter on LinkedIn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452z"/></svg></a></div>
  </div>
 </footer>;
}
