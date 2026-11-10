import HeroSpotlightState from './HeroSpotlightState';
import type {ReactNode} from 'react';
export default function LandingHero({search,spotlight}:{search:ReactNode;spotlight?:ReactNode}){
 return <section className="lawvetter-landing-hero" aria-labelledby="lawvetter-hero-title">
  <div className="landing-hero-copy">
   <p className="landing-hero-kicker">CLIENT EXPERIENCES · PROFESSIONAL RECORDS</p>
   <h1 id="lawvetter-hero-title">The Smarter Way to Find a Lawyer.</h1>
   <p className="landing-hero-deck">Search attorneys, compare profiles, and read verified reviews from real clients.</p>
   {search}
   <div className="landing-hero-record-note">
    <strong>Verified Reviews from Real Clients.</strong>
    <span>Read verified client experiences, explore attorney records, and compare the details before you decide.</span>
   </div>
  </div>
  <div className="landing-hero-visual landing-ranking-visual">{spotlight||<HeroSpotlightState/>}</div>
 </section>;
}
