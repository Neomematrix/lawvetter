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
  <div className="landing-hero-visual">
   <figure className="landing-hero-photo">
    <img src="/images/lawvetter-attorney-welcome.jpg" alt="Smiling attorney in a professional office" />
   </figure>
  </div>
 </section>;
}
