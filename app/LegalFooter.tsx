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
    <a href="https://www.gabar.org/member-directory/?state=GA" target="_blank" rel="noopener noreferrer">State Bar directory</a>
   </nav>
   <div className="legal-disclaimer" role="note" aria-label="Legal disclaimer">
    <p><strong>Important disclaimer.</strong> LawVetter is an independent information and review platform, not a law firm, and does not provide legal advice. Use of this site does not create an attorney-client relationship. Attorney, firm, licensing-status, ranking, and directory information comes from public, third-party, and user-submitted sources. It may be incomplete, inaccurate, delayed, or change without notice. Always verify current information directly with the State Bar of Georgia and the attorney or firm.</p>
    <p>Rankings, profile placement, and client reviews are not endorsements or guarantees. Client reviews are the opinions of individual users and do not reflect LawVetter&rsquo;s views. Verification confirms only that LawVetter reviewed evidence of a client relationship; it does not establish that every statement in a review is true, accurate, or complete. To the fullest extent permitted by law, LawVetter is not responsible for decisions made in reliance on directory information or user-submitted content.</p>
    <p><strong>Content-use notice.</strong> Except as permitted by applicable law or expressly authorized in writing by LawVetter, users may not scrape, reproduce, republish, redistribute, sell, license, or commercially exploit LawVetter content or directory data. This includes profiles, biographies, reviews, ratings, photos, badges, Q&amp;A content, rankings, and bulk contact lists. Automated collection that burdens, bypasses, or interferes with the site is prohibited.</p>
   </div>
   <small>© 2026 LawVetter. All rights reserved.</small>
  </div>
 </footer>;
}
