export default function AttorneyBenefits(){
 return <section className="attorney-benefits" aria-labelledby="attorney-benefits-title">
  <div className="attorney-benefits-copy">
   <p className="section-kicker">YOUR PRACTICE. YOUR NEXT CONNECTION.</p>
   <h2 id="attorney-benefits-title">Be seen. Build connections.<br/>Know where you stand.</h2>
   <p className="attorney-benefits-intro">Manage your individual attorney profile or firm page, understand your visibility, and help prospective clients find the legal services you offer.</p>
   <div className="attorney-benefits-grid">
    <article><span className="benefit-art-icon" aria-hidden="true"><img src="/benefit-icons/ranking.svg" alt="" width="28" height="28"/></span><h3>See your ranking</h3><p>Check your current placement in the weekly and monthly attorney charts.</p></article>
    <article><span className="benefit-art-icon" aria-hidden="true"><img src="/benefit-icons/momentum.svg" alt="" width="28" height="28"/></span><h3>Free visitor analytics</h3><p>View profile visits and search activity at no cost after your attorney claim or firm access is approved.</p></article>
    <article><span className="benefit-art-icon" aria-hidden="true"><img src="/benefit-icons/profile.svg" alt="" width="28" height="28"/></span><h3>Take ownership of your professional profile</h3><p>Verify your identity to receive a Claimed badge and manage your photo, practice areas, and contact information after approval. Help visitors recognize that you have claimed your LawVetter profile.</p></article>
    <article><span className="benefit-art-icon" aria-hidden="true"><img src="/benefit-icons/connect-clients.png" alt="" width="28" height="28"/></span><h3>Connect with clients</h3><p>Help people seeking your services find your practice. LawVetter reviews contact requests and helps clients follow up.</p></article>
   </div>
   <p className="attorney-benefits-note">Free profile management and visitor analytics. Profile claims require approval. Rankings reflect search activity or client ratings and do not measure legal ability.</p>
  </div>
  <figure className="attorney-benefits-photo"><img src="/attorney-community-columns.webp" alt="Sunlight between monumental stone columns" width="900" height="1350" decoding="async" fetchPriority="high"/><figcaption>Build a stronger professional presence.</figcaption></figure>
 </section>;
}
