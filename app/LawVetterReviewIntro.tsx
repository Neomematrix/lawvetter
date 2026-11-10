export default function LawVetterReviewIntro({id='lawvetter-review-intro',headingLevel=2,compact=false}:{id?:string;headingLevel?:1|2;compact?:boolean}){
 const Heading=headingLevel===1?'h1':'h2';
 return <section className={'lawvetter-review-intro'+(compact?' review-intro-compact':'')} aria-labelledby={id}>
  <div className="review-intro-main">
   <p className="review-intro-eyebrow">KNOW WHO YOU HIRE</p>
   <Heading id={id}>Real reviews<br/><span>Real clients</span></Heading>
   <p className="review-intro-lead">Find a lawyer. Read verified client reviews. Make the right choice next time you hire an attorney.</p>
   <p className="review-intro-description">LawVetter helps you find lawyers, compare attorney profiles, and learn from people they have represented. Every published lawyer review comes from a client whose relationship with the attorney has been verified through court records.</p>
   {!compact&&<div className="review-intro-actions"><a className="review-intro-primary" href="/#attorney-search">Find a lawyer <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></a><a className="review-intro-secondary" href="/client-reviews?mode=register">Review your lawyer</a></div>}
   {compact&&<div className="review-intro-account-notes"><p><strong>Court records checked.</strong> Every published review comes from a verified client.</p><p><strong>Public or anonymous.</strong> Choose whether your name appears with your review. Both options require verification.</p></div>}
   <p className="review-intro-signature">Hire right, with LawVetter</p>
  </div>
  {!compact&&<div className="review-intro-proof">
   <div className="review-intro-seal"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 4 40 10v12c0 10-6 17-16 22C14 39 8 32 8 22V10L24 4Z"/><path d="m16 24 6 6 11-12"/></svg><span>VERIFIED CLIENT VOICES</span></div>
   <div className="review-intro-detail"><h3>Court records checked</h3><p>We verify the client and attorney relationship before a review can be published.</p></div>
   <div className="review-intro-detail"><h3>Your experience. Your choice.</h3><p>Submit your review with your name displayed publicly or publish it anonymously. Both options require client verification.</p></div>
   <div className="review-intro-detail"><h3>Help the next client hire right</h3><p>Share your experience so others can make a more informed decision.</p></div>
  </div>}
 </section>;
}
