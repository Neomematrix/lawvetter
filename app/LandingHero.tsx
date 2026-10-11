export default function LandingHero(){
 return <section className="lawvetter-landing-hero" aria-labelledby="lawvetter-hero-title">
  <div className="landing-hero-copy">
   <p className="landing-hero-kicker">CLIENT EXPERIENCES · PROFESSIONAL RECORDS</p>
   <h1 id="lawvetter-hero-title">Real reviews from real clients of lawyers.</h1>
   <p className="landing-hero-deck">Read verified client experiences, explore attorney records, and compare the details before you decide.</p>
   <div className="landing-hero-actions">
    <a className="landing-primary-cta" href="/client-reviews">Read client reviews</a>
    <a className="landing-secondary-cta" href="#attorney-search">Find an attorney</a>
   </div>
  </div>
  <div className="landing-hero-visual" aria-label="How LawVetter client reviews work">
   <article className="landing-proof-card">
    <div className="landing-proof-body">
     <p className="landing-proof-eyebrow">Review check</p>
     <h2>We check the client relationship behind every review.</h2>
     <ol>
      <li><span>01</span><div><strong>Case number checked</strong><small>When provided, we compare it with available court-docket records.</small></div></li>
      <li><span>02</span><div><strong>Client connection reviewed</strong><small>We confirm the reviewer is connected to the legal matter.</small></div></li>
      <li><span>03</span><div><strong>Review connected</strong><small>The review appears on the attorney&rsquo;s profile.</small></div></li>
     </ol>
     <p className="landing-proof-note">
      Court-record availability varies by court and case. Verification confirms the relationship—not every claim.
      <a href="https://georgiacourts.gov/eaccess-court-records/" target="_blank" rel="noreferrer">Georgia court-record access ↗</a>
     </p>
    </div>
   </article>
  </div>
 </section>;
}
