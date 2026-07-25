"use client";

import { FormEvent, useState } from "react";

type Tab = "profile" | "referral";

const reviews = [
  {
    initials: "MR",
    name: "Marisa R.",
    meta: "Former client · Employment matter",
    date: "May 14, 2026",
    title: "Clear, strategic, and genuinely attentive",
    body: "John explained every option without making promises he couldn’t keep. I always knew what was happening and felt prepared for each step. His team was responsive and the result gave me real peace of mind.",
  },
  {
    initials: "DL",
    name: "David L.",
    meta: "Former client · Business dispute",
    date: "March 2, 2026",
    title: "The steady hand our company needed",
    body: "He quickly understood the business issues behind the legal dispute. Practical advice, thoughtful negotiation, and no wasted motion. I would work with him again.",
  },
  {
    initials: "AK",
    name: "Alicia K.",
    meta: "Former client · Contract matter",
    date: "January 19, 2026",
    title: "Professional from the first call",
    body: "The consultation was direct and useful. John listened carefully, outlined a realistic plan, and followed through exactly as discussed.",
  },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("profile");
  const [rating, setRating] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [referralSent, setReferralSent] = useState(false);

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewSent(true);
  }

  function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReferralSent(true);
  }

  return (
    <main>
      <header className="site-header">
        <div className="nav-shell">
          <button className="brand" onClick={() => setTab("profile")} aria-label="CounselCheck home">
            <span className="brand-mark">C</span>
            <span>COUNSEL<span>CHECK</span></span>
          </button>
          <nav aria-label="Primary navigation">
            <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
              Attorney profiles
            </button>
            <button className={tab === "referral" ? "active" : ""} onClick={() => setTab("referral")}>
              Find an attorney
            </button>
          </nav>
          <button className="nav-cta" onClick={() => setTab("referral")}>
            Get matched <span>→</span>
          </button>
        </div>
      </header>

      {tab === "profile" ? (
        <>
          <section className="search-band" aria-label="Attorney search">
            <div>
              <p className="eyebrow light">Independent attorney information</p>
              <h1>Know who represents you.</h1>
              <form className="search-box" onSubmit={(e) => e.preventDefault()}>
                <span aria-hidden="true">⌕</span>
                <label className="sr-only" htmlFor="attorney-search">Search attorney name or firm</label>
                <input id="attorney-search" defaultValue="John Smith" placeholder="Search attorney name or firm" />
                <button type="submit">Search</button>
              </form>
              <p className="search-note">Search results are compiled from state bar records and client-submitted reviews.</p>
            </div>
          </section>

          <div className="page-shell profile-layout">
            <section className="profile-main">
              <div className="breadcrumb">Search results <span>/</span> Johnathan Smith</div>
              <article className="profile-card">
                <div className="profile-heading">
                  <div className="portrait" aria-label="Johnathan Smith profile photo">
                    <span>JS</span>
                  </div>
                  <div className="identity">
                    <div className="verified-line"><span>✓</span> Bar record verified</div>
                    <h2>Johnathan “John” Smith</h2>
                    <p className="role">Employment &amp; Business Litigation Attorney</p>
                    <a className="firm-link" href="#firm">Harrison, Smith &amp; Cole LLP <span>↗</span></a>
                    <p className="location">Boston, Massachusetts · Licensed for 14 years</p>
                  </div>
                  <div className="rating-summary">
                    <div className="rating-number">4.8</div>
                    <div>
                      <div className="stars" aria-label="4.8 out of 5 stars">★★★★★</div>
                      <a href="#reviews">37 client reviews</a>
                    </div>
                  </div>
                </div>

                <div className="trust-strip">
                  <div><strong>97%</strong><span>Would recommend</span></div>
                  <div><strong>4.9</strong><span>Communication</span></div>
                  <div><strong>4.7</strong><span>Value</span></div>
                  <div><strong>4.8</strong><span>Responsiveness</span></div>
                </div>

                <div className="profile-body">
                  <section>
                    <p className="section-kicker">About</p>
                    <h3>Practical counsel for consequential moments.</h3>
                    <p>
                      John Smith represents individuals and growing businesses in employment disputes,
                      partnership conflicts, and complex commercial litigation. Clients describe his
                      approach as direct, calm, and deeply prepared.
                    </p>
                    <p>
                      Before joining Harrison, Smith &amp; Cole, John served as a judicial law clerk in
                      the Massachusetts Superior Court.
                    </p>
                  </section>

                  <section className="credentials">
                    <p className="section-kicker">Professional credentials</p>
                    <dl>
                      <div>
                        <dt>Bar status</dt>
                        <dd><span className="status-dot"></span> Active &amp; in good standing</dd>
                      </div>
                      <div>
                        <dt>Bar number</dt>
                        <dd>MA #681429</dd>
                      </div>
                      <div>
                        <dt>Admitted</dt>
                        <dd>November 18, 2011</dd>
                      </div>
                      <div>
                        <dt>Jurisdiction</dt>
                        <dd>Massachusetts</dd>
                      </div>
                      <div>
                        <dt>Law school</dt>
                        <dd>Boston University School of Law, 2011</dd>
                      </div>
                    </dl>
                    <p className="record-note">Last verified with the Massachusetts Bar on July 18, 2026.</p>
                  </section>
                </div>
              </article>

              <section className="reviews-section" id="reviews">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Client perspective</p>
                    <h2>Reviews &amp; recommendations</h2>
                  </div>
                  <button className="outline-button" onClick={() => setReviewOpen(true)}>Write a review</button>
                </div>

                <div className="review-summary-card">
                  <div className="big-score"><strong>4.8</strong><span className="stars">★★★★★</span><small>Based on 37 reviews</small></div>
                  <div className="rating-bars">
                    {[["5", "88%"], ["4", "9%"], ["3", "3%"], ["2", "0%"], ["1", "0%"]].map(([star, width]) => (
                      <div className="bar-row" key={star}>
                        <span>{star} star</span>
                        <i><b style={{ width }}></b></i>
                        <small>{width}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="review-list">
                  {reviews.map((review) => (
                    <article className="review" key={review.name}>
                      <div className="review-top">
                        <div className="reviewer">
                          <span className="avatar">{review.initials}</span>
                          <div><strong>{review.name}</strong><small>{review.meta}</small></div>
                        </div>
                        <time>{review.date}</time>
                      </div>
                      <div className="stars small" aria-label="5 out of 5 stars">★★★★★ <em>5.0</em></div>
                      <h3>{review.title}</h3>
                      <p>{review.body}</p>
                      <div className="recommended">✓ Recommends this attorney</div>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <aside className="profile-sidebar">
              <div className="contact-card" id="firm">
                <p className="section-kicker">Contact information</p>
                <h3>Harrison, Smith<br />&amp; Cole LLP</h3>
                <address>200 Clarendon Street, Suite 1800<br />Boston, MA 02116</address>
                <a href="tel:+16175550184">(617) 555-0184</a>
                <a href="mailto:jsmith@example.com">Email this attorney</a>
                <button onClick={() => setTab("referral")}>Request a consultation</button>
                <small>Contacting an attorney does not create an attorney–client relationship.</small>
              </div>
              <div className="independent-note">
                <span>i</span>
                <div><strong>Why trust this profile?</strong><p>License information comes from public bar records. Reviews are screened for authenticity but do not predict outcomes.</p></div>
              </div>
            </aside>
          </div>
        </>
      ) : (
        <section className="referral-page">
          <div className="referral-hero">
            <div className="referral-intro">
              <p className="eyebrow light">A thoughtful legal referral</p>
              <h1>Tell us what happened.<br /><em>We’ll help you find a path forward.</em></h1>
              <p className="lead">
                Share a few details about your situation and we’ll connect you with a vetted law firm
                that handles matters like yours.
              </p>
              <div className="referral-points">
                <div><span>01</span><p><strong>Private by design</strong>Your information is only shared with potential matching firms.</p></div>
                <div><span>02</span><p><strong>No cost to get matched</strong>There is no fee or obligation to submit a request.</p></div>
                <div><span>03</span><p><strong>Human-reviewed</strong>Every request is reviewed before a referral is made.</p></div>
              </div>
              <blockquote>
                “The right attorney should understand both the legal issue and what’s at stake for you.”
              </blockquote>
            </div>

            <div className="intake-card">
              {referralSent ? (
                <div className="success-state">
                  <span>✓</span>
                  <p className="section-kicker">Request received</p>
                  <h2>Thank you for trusting us.</h2>
                  <p>A referral specialist will review your information and follow up within one business day.</p>
                  <button onClick={() => setTab("profile")}>Return to attorney profiles</button>
                </div>
              ) : (
                <form onSubmit={submitReferral}>
                  <div className="form-heading">
                    <p className="section-kicker">Confidential intake</p>
                    <h2>Find the right attorney</h2>
                    <p>Usually takes less than 3 minutes.</p>
                  </div>
                  <div className="field-row">
                    <label>First name<input required name="firstName" placeholder="First name" /></label>
                    <label>Last name<input required name="lastName" placeholder="Last name" /></label>
                  </div>
                  <div className="field-row">
                    <label>Email address<input required type="email" name="email" placeholder="you@example.com" /></label>
                    <label>Phone number<input required type="tel" name="phone" placeholder="(555) 000-0000" /></label>
                  </div>
                  <label>What kind of legal help do you need?
                    <select required defaultValue="">
                      <option value="" disabled>Select an area of law</option>
                      <option>Employment &amp; workplace</option>
                      <option>Business &amp; contracts</option>
                      <option>Personal injury</option>
                      <option>Family &amp; divorce</option>
                      <option>Criminal defense</option>
                      <option>Estate planning</option>
                      <option>Other / Not sure</option>
                    </select>
                  </label>
                  <label>Where do you need an attorney?
                    <input required placeholder="City or ZIP code" />
                  </label>
                  <label>Briefly describe your situation
                    <textarea required rows={5} placeholder="What happened, and what outcome are you hoping for? Please don’t include highly sensitive information." />
                  </label>
                  <label className="checkbox">
                    <input required type="checkbox" />
                    <span>I agree that CounselCheck may contact me and share this request with potential matching law firms.</span>
                  </label>
                  <button className="submit-button" type="submit">Request my referral <span>→</span></button>
                  <p className="form-disclaimer">Submitting this form does not create an attorney–client relationship. Do not use this service for emergencies or court deadlines.</p>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      <footer>
        <div className="footer-brand"><span className="brand-mark">C</span><strong>COUNSELCHECK</strong></div>
        <p>Independent information for more confident legal decisions.</p>
        <div><a href="#">About</a><a href="#">Review policy</a><a href="#">For attorneys</a><a href="#">Privacy</a></div>
        <small>© 2026 CounselCheck. Attorney advertising. Prior results do not guarantee a similar outcome.</small>
      </footer>

      {reviewOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setReviewOpen(false)}>
          <div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setReviewOpen(false)} aria-label="Close review form">×</button>
            {reviewSent ? (
              <div className="success-state compact">
                <span>✓</span>
                <h2>Thank you for sharing.</h2>
                <p>Your review will be checked for authenticity before it appears publicly.</p>
                <button onClick={() => setReviewOpen(false)}>Done</button>
              </div>
            ) : (
              <form onSubmit={submitReview}>
                <p className="section-kicker">Share your experience</p>
                <h2 id="review-title">Review John Smith</h2>
                <p>Your honest feedback can help someone make a more informed decision.</p>
                <fieldset>
                  <legend>Your overall rating</legend>
                  <div className="star-picker">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button type="button" key={star} className={rating >= star ? "selected" : ""} onClick={() => setRating(star)} aria-label={`${star} star rating`}>★</button>
                    ))}
                  </div>
                </fieldset>
                <label>Review title<input required placeholder="Summarize your experience" /></label>
                <label>Your recommendation<textarea required rows={5} placeholder="What should future clients know?" /></label>
                <label className="checkbox"><input required type="checkbox" /><span>I confirm this review reflects my genuine experience.</span></label>
                <button className="submit-button" disabled={!rating}>Submit review</button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
