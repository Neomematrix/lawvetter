export default function LandingHero(){
 return <section className="lawvetter-landing-hero" aria-labelledby="lawvetter-hero-title">
  <div className="landing-hero-copy">
   <p className="landing-hero-kicker">CLIENT EXPERIENCES · PROFESSIONAL RECORDS</p>
   <h1 id="lawvetter-hero-title">Real reviews from real clients of lawyers.</h1>
   <p className="landing-hero-deck">Read verified client experiences, explore Georgia attorney records, and compare the details before you decide.</p>
   <div className="landing-hero-actions">
    <a className="landing-primary-cta" href="/client-reviews">Read client reviews</a>
    <a className="landing-secondary-cta" href="#attorney-search">Find an attorney</a>
   </div>
  </div>
  <div className="landing-hero-visual" aria-label="How LawVetter client reviews work">
   <img className="landing-hero-owl" src="/brand/lawvetter-icon.svg" alt="" aria-hidden="true"/>
   <article className="landing-proof-card">
    <p className="landing-proof-eyebrow">A clearer review record</p>
    <h2>Experience, connected to evidence.</h2>
    <ol>
     <li><span>01</span><div><strong>Client identity checked</strong><small>The reviewer is matched to the person named in the case.</small></div></li>
     <li><span>02</span><div><strong>Relationship reviewed</strong><small>The attorney–client relationship is checked before posting unlocks.</small></div></li>
     <li><span>03</span><div><strong>Professional record linked</strong><small>Reviews appear alongside the attorney&rsquo;s directory information.</small></div></li>
    </ol>
    <p className="landing-proof-note">Verification confirms a client relationship—not every statement in a review.</p>
   </article>
  </div>
 </section>;
}
