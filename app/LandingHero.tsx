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
    <div className="landing-proof-rail" aria-hidden="true">
     <span>LAWVETTER</span>
     <b>01—03</b>
    </div>
    <div className="landing-proof-body">
     <p className="landing-proof-eyebrow">Review check</p>
     <h2>Every review starts with a real client.</h2>
     <ol>
      <li><span>01</span><div><strong>Client matched</strong><small>Reviewer identity is checked against the case record.</small></div></li>
      <li><span>02</span><div><strong>Relationship confirmed</strong><small>The attorney–client relationship is verified.</small></div></li>
      <li><span>03</span><div><strong>Review connected</strong><small>The review appears on the attorney&rsquo;s profile.</small></div></li>
     </ol>
     <p className="landing-proof-note">Verification confirms the relationship—not every claim in a review.</p>
    </div>
   </article>
  </div>
 </section>;
}
