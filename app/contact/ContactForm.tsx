'use client';
import {formatPhoneEvent} from '../phone-format';
import {useRef,useState} from 'react';
import DirectoryCaptcha from '../DirectoryCaptcha';
import CityStateAutocomplete from '../CityStateAutocomplete';
import {minimumSituationWords,wordCount} from '../form-words';

export default function ContactForm(){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const id=useRef('');
 const confirmation=useRef<HTMLHeadingElement>(null);
 const [receipt,setReceipt]=useState({name:'',email:''});
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!ready||busy)return;
  const form=new FormData(event.currentTarget),message=String(form.get('message')||'').trim(),phone=String(form.get('phone')||'').trim();
  if(phone&&phone.replace(/\D/g,'').length<7){setError('Enter a valid phone number.');return;}
  if(wordCount(message)<minimumSituationWords){setError('Please provide more detail in your message.');return;}
  setBusy(true);setError('');if(!id.current)id.current=crypto.randomUUID();
  try{
   const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id.current,name:form.get('name'),email:form.get('email'),city:form.get('city'),phone,practice:'other',urgency:'routine',contactMethod:'email',summary:'Contact LawVetter request: '+message,consent:form.get('consent')==='on',website:form.get('website'),captchaToken:form.get('captchaToken')})});
   const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error||'Unable to send your request.');setReceipt({name:String(form.get('name')||'').trim().split(/\s+/)[0],email:String(form.get('email')||'').trim()});setSent(true);requestAnimationFrame(()=>confirmation.current?.focus());
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to send your request. Please try again.');}
  finally{setBusy(false);setAttempt(value=>value+1);}
 }
 if(sent)return <section className="contact-intake-pane contact-confirmation" role="status" aria-labelledby="contact-thanks">
  <div className="contact-success-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="m10 20 7 7 14-15" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
  <h2 id="contact-thanks" ref={confirmation} tabIndex={-1}>Thanks{receipt.name?', '+receipt.name:''}.<br/>We received your message.</h2>
  <div className="contact-receipt-note"><span aria-hidden="true">✉</span><p>The LawVetter team will review your request. If a reply is needed, we will contact you at <strong>{receipt.email}</strong>.</p></div>
  <div className="contact-next-steps"><div><span>1</span><div><h3>Message received</h3><p>Your message has been saved for our team to review.</p></div></div><div><span>2</span><div><h3>Team review</h3><p>If a reply is needed, we will contact you using the information you provided.</p></div></div></div>
  <div className="contact-confirmation-actions"><a href="/" className="contact-back">Back to LawVetter</a><button type="button" onClick={()=>{id.current='';setReady(false);setError('');setSent(false);setAttempt(v=>v+1);requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.contact-intake-pane input[name="name"]')?.focus());}}>Send another message <span aria-hidden="true">→</span></button></div>
 </section>;
 return <form className="intake-form contact-intake-pane" data-analytics-exclude="true" data-analytics-form="general_contact" onSubmit={submit}>
  <div className="contact-pane-heading"><h2>Send us a message</h2><span className="contact-required-note">Fields marked * are required.</span></div>
  <div className="contact-details-row">
  <label>Full name *<input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Your full name"/></label>
  <label>Email address *<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label>
  </div>
  <div className="contact-details-row contact-location-row"><label>Phone number <span className="contact-optional">(optional)</span><input name="phone" type="tel" onChange={formatPhoneEvent} autoComplete="tel" inputMode="tel" maxLength={40} placeholder="123-456-7890"/></label>
  <CityStateAutocomplete/></div>
  <label>Your message *<textarea name="message" required rows={3} maxLength={2900} placeholder="Tell us how we can help."/></label>
  <p className="contact-sensitive-note">Please do not include sensitive documents or identification numbers.</p>
  <div className="contact-bottom-row"><label className="lead-consent"><input name="consent" type="checkbox" required/><span>I agree that LawVetter may save my request and contact me about it. My request will not be posted publicly.</span></label></div>
  <label className="lead-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
  <div className="contact-submit-row"><DirectoryCaptcha attempt={attempt} onReady={setReady}/>
  {error&&<p role="alert">{error}</p>}
  <div className="contact-send-row"><span>No account required</span><button className="gold-button" disabled={busy||!ready}>{busy?'Sending your request…':'Send message'}<span aria-hidden="true">→</span></button></div></div>
 </form>;
}
