"use client";

import { FormEvent, useState } from "react";
import GeorgiaDirectory from "./GeorgiaDirectory";

type Tab = "profile" | "referral";

export default function Home() {
  const [tab, setTab] = useState<Tab>("profile");
  const [homeKey,setHomeKey]=useState(0);
  function goHome(){setTab('profile');setHomeKey(k=>k+1);}
  const [referralSent, setReferralSent] = useState(false);

  function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReferralSent(true);
  }

  return (
    <main>
      <header className="site-header">
        <div className="nav-shell">
          <button className="brand" onClick={goHome} aria-label="CounselCheck home">
            <span className="brand-mark">C</span>
            <span>COUNSEL<span>CHECK</span></span>
          </button>
          <nav aria-label="Primary navigation">
            <button className={tab === "profile" ? "active" : ""} onClick={goHome}>
              Home
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
        <GeorgiaDirectory key={homeKey} />
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
                  <button onClick={goHome}>Return to attorney profiles</button>
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


    </main>
  );
}
