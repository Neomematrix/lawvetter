'use client';
import {useShortlist} from './Shortlist';
export default function LegalFooter(){
 const shortlist=useShortlist();
 return <footer className="discovery-footer legal-footer">
  <div className="legal-footer-inner">
   <div className="footer-brand"><img className="lawvetter-footer-logo" src="/brand/lawvetter-header.svg" alt="LawVetter"/></div>
   <p className="legal-footer-tagline">Know who represents you.</p>
   <nav className="legal-footer-links" aria-label="Footer navigation">
    <a href="/">Discover</a>
    <a href="/?view=charts">Rankings &amp; methodology</a>
    {shortlist.signedIn&&<a href="/?view=shortlist">Your shortlist</a>}
    <a href="/account">Claim your profile</a>
    <a href="/disclaimer">Disclaimer &amp; content use</a>
    <a href="https://www.gabar.org/member-directory/?state=GA" target="_blank" rel="noopener noreferrer">State Bar directory</a>
   </nav>
   <p className="legal-footer-summary" role="note">LawVetter provides general information, not legal advice. <a href="/disclaimer">Read the full disclaimer and content-use terms.</a></p>
   <small>© 2026 LawVetter. All rights reserved.</small>
  </div>
 </footer>;
}
