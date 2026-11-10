import {useEffect,useRef} from 'react';
export default function ReferralConfirmation({attorney}:{attorney?:{name:string;verified?:boolean}}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});heading.current?.focus({preventScroll:true});},[]);
 return <div className="referral-confirmation-wrap referral-receipt-layout"><header className="referral-receipt-intro"><p className="section-kicker">{attorney?'DIRECT MESSAGE':'CONTACT LAWVETTER'}</p><h1>{attorney?'Contact '+attorney.name:'Find legal help'}</h1><p>{attorney?'A private connection to your selected attorney.':'Help finding your next step.'}</p><ol><li><strong>Share your needs</strong><span>Describe the legal help you need.</span></li><li><strong>{attorney?'Attorney review':'LawVetter review'}</strong><span>{attorney?'The attorney can review your message and contact you.':'Our team reviews your request and contacts you.'}</span></li><li><strong>You choose what’s next</strong><span>Sending a request does not commit you to hiring.</span></li></ol></header><section className="referral-confirmation" aria-labelledby="referral-confirmation-title">
  <div className="referral-confirmation-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 12 3 3 7-7"/><circle cx="12" cy="12" r="10"/></svg></div>
  <p className="section-kicker">REQUEST RECEIVED</p>
  <h2 className="referral-receipt-title" ref={heading} tabIndex={-1} id="referral-confirmation-title">Your request is sent.</h2>
  <p className="referral-confirmation-summary">{attorney?<>Your message is saved in <strong>{attorney.name}’s private inbox.</strong></>:<>Your request is saved for <strong>LawVetter to review.</strong></>}</p>
  <div className="referral-confirmation-next"><h2>What happens next?</h2><p>{attorney?'The attorney may contact you using the details you provided.':'Our team will review your request and contact you using the details you provided.'}</p></div>
  <a className="gold-button" href="/discover">Explore attorneys</a>
  <p className="referral-confirmation-note">You decide whether to hire an attorney. Sending a request does not commit you.</p>
 </section></div>;
}
