export default function LandingHero(){
 return <section className="lawvetter-landing-hero" aria-labelledby="lawvetter-hero-title">
  <div className="landing-hero-copy">
   <p className="landing-hero-kicker">CLIENT EXPERIENCES · PROFESSIONAL RECORDS</p>
   <h1 id="lawvetter-hero-title">Real reviews from real clients of lawyers.</h1>
   <p className="landing-hero-deck">Read verified client experiences, explore attorney records, and compare the details before you decide.</p>
   <a href="#lawvetter-review-check-title" aria-label="Learn how LawVetter checks court records and client relationships" style={{display:'flex',alignItems:'center',gap:14,padding:'16px 18px',margin:'22px 0 18px',border:'1px solid rgba(245,195,91,.7)',borderRadius:16,background:'linear-gradient(135deg,#07346a,#0b5592)',color:'#fff',textDecoration:'none',boxShadow:'0 8px 20px rgba(0,25,64,.22)'}}>
    <span aria-hidden="true" style={{width:58,height:64,flexShrink:0,display:'grid',placeItems:'center',fontSize:35,color:'#ffd577',background:'linear-gradient(145deg,#194f83,#05264e)',border:'3px solid #f1c568',borderRadius:'45% 45% 48% 48%'}}>⚖</span>
    <span style={{display:'grid',gap:4,flex:1,minWidth:0}}><strong style={{fontSize:'1.08rem',lineHeight:1.25}}>Court-Record Verified Reviews</strong><span style={{fontSize:'.88rem',lineHeight:1.4,color:'#e5effa'}}>Real client experiences supported by court records to help protect review integrity.</span></span>
    <span aria-hidden="true" style={{fontSize:26,color:'#ffd577'}}>›</span>
   </a>
   <div className="landing-hero-actions">
    <a className="landing-primary-cta" href="/client-reviews">Leave Client Review</a>
    <a className="landing-secondary-cta" href="#attorney-search">Find an attorney</a>
   </div>
  </div>
  <div className="landing-hero-visual">
   <figure className="landing-hero-photo">
    <img src="/images/lawvetter-attorney-welcome.jpg" alt="Smiling attorney in a professional office" />
   </figure>
   <section className="landing-hero-proof" aria-labelledby="lawvetter-review-check-title">
    <h2 id="lawvetter-review-check-title">We check the client relationship behind every review.</h2>
    <ol>
     <li><span>01</span><div><strong>Case number checked</strong><small>When provided, we compare it with available court docket records.</small></div></li>
     <li><span>02</span><div><strong>Client connection reviewed</strong><small>We confirm the reviewer is connected to the legal matter.</small></div></li>
     <li><span>03</span><div><strong>Review connected</strong><small>The review appears on the attorney&rsquo;s profile.</small></div></li>
    </ol>
   </section>
  </div>
 </section>;
}
