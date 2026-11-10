'use client';
import LanguagePicker from '../LanguagePicker';
import {formatPhoneEvent} from '../phone-format';
import {requireFirmSubmission} from '../firm-submission-requirements';
import {requireAttorneyLocation} from '../attorney-location';
import FirmImageUpload from '../admin/records/FirmImageUpload';
import PhotoFrameEditor from '../PhotoFrameEditor';
import DirectoryCaptcha from '../DirectoryCaptcha';
import CityAutocomplete from '../CityAutocomplete';
import ListingAddressFields from './ListingAddressFields';
import ListingPracticePicker from './ListingPracticePicker';
import {FormEvent,useEffect,useRef,useState} from 'react';

const states=[
 ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];
type Kind='lawyer'|'firm';
export default function AddListing({ownershipRequest=false,initialFirm='',initialFirmWebsite=''}:{ownershipRequest?:boolean;initialFirm?:string;initialFirmWebsite?:string}){
 const formRef=useRef<HTMLFormElement>(null);
 const [step,setStep]=useState(0);
 function kindLabel(value:Kind){return value==='lawyer'?'Lawyer details':'Firm details';}
 const [photoPreparing,setPhotoPreparing]=useState(false);
 const [websiteHelpOpen,setWebsiteHelpOpen]=useState(false);
 const [barHelpOpen,setBarHelpOpen]=useState(false);
 const [practiceAreas,setPracticeAreas]=useState('');
 const [languages,setLanguages]=useState('');
 const [captchaReady,setCaptchaReady]=useState(false);
 const [state,setState]=useState(''),[city,setCity]=useState(''),[photo,setPhoto]=useState<File|null>(null);

 const [kind,setKind]=useState<Kind>(ownershipRequest?'firm':'lawyer'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[attempt,setAttempt]=useState(0),[submitted,setSubmitted]=useState<{name:string;id:string;emailStatus:string}|null>(null);
 const stepNames=[kindLabel(kind),'Professional details','Your details'];
 useEffect(()=>{const value=new URLSearchParams(window.location.search).get('type');if(value==='firm')setKind('firm');},[]);
 function choose(next:Kind){if(next===kind)return;setKind(next);setStep(0);setCaptchaReady(false);setWebsiteHelpOpen(false);setBarHelpOpen(false);setError('');setSuccess('');setSubmitted(null);setPhoto(null);setPhotoPreparing(false);setState('');setCity('');setPracticeAreas('');setLanguages('');window.history.replaceState(null,'','/add-listing?type='+next);}
 function validatePanel(index:number){
  const panel=formRef.current?.querySelector<HTMLElement>(`[data-listing-step="${index}"]`);
  if(!panel)return false;
  const invalid=Array.from(panel.querySelectorAll('input,select,textarea'),field=>field as unknown as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement).find(field=>!field.checkValidity());
  if(invalid){setStep(index);setTimeout(()=>invalid.reportValidity(),0);return false;}
  return true;
 }
 function goToStep(next:number){
  if(busy||photoPreparing)return;
  if(next>step){for(let index=0;index<next;index++){if(!validatePanel(index))return;}}
  setError('');setWebsiteHelpOpen(false);setBarHelpOpen(false);setStep(next);
  requestAnimationFrame(()=>formRef.current?.querySelector<HTMLElement>(`[data-listing-step="${next}"] h2`)?.focus());
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||photoPreparing)return;if(step<2){goToStep(step+1);return;}for(let index=0;index<3;index++){if(!validatePanel(index))return;}if(kind==='lawyer'&&!String(new FormData(event.currentTarget).get('officialSourceUrl')||'').trim()){setError('Please add the official state bar membership link.');return;}if(!captchaReady){setError('Complete the human verification before submitting.');return;}setBusy(true);setError('');setSuccess('');
  const formElement=event.currentTarget,form=new FormData(formElement),payload=Object.fromEntries(form.entries());
  try{
   payload.submitterName=[payload.submitterFirstName,payload.submitterLastName].map(value=>String(value||'').trim()).filter(Boolean).join(' ');
   if(!String(payload.submitterFirstName||'').trim()||!String(payload.submitterLastName||'').trim())throw Error('Enter your first and last name.');
   if(String(payload.submitterName).length>150)throw Error('Your full name must be 150 characters or fewer.');
   delete payload.submitterFirstName;delete payload.submitterMiddleName;delete payload.submitterLastName;
   delete payload.photo;if(ownershipRequest)payload.notes='Firm ownership review request. '+String(payload.notes||'');
   if(photo&&(!['image/jpeg','image/png'].includes(photo.type)||photo.size>3*1024*1024))throw new Error('Choose a JPEG or PNG photo smaller than 3 MB.');
   if(kind==='firm')requireFirmSubmission(payload);
   if(kind==='lawyer'){
    if(!practiceAreas.trim())throw new Error('Select at least one practice area from the list.');
    requireAttorneyLocation(payload.city,payload.state);
    const firstName=String(payload.firstName||'').trim(),middleName=String(payload.middleName||'').trim(),lastName=String(payload.lastName||'').trim();
    if(!firstName||!lastName)throw new Error('Enter the lawyer’s first and last name.');
    payload.name=[firstName,middleName,lastName].filter(Boolean).join(' ');
    if(String(payload.name).length>180)throw new Error('The lawyer’s full name must be 180 characters or fewer.');
    delete payload.firstName;delete payload.middleName;delete payload.lastName;
   }
   const upload=new FormData();upload.set('data',JSON.stringify({...payload,action:'submit',kind}));if(photo)upload.set('photo',photo);
   const response=await fetch('/api/directory-submissions',{method:'POST',credentials:'include',body:upload});
   const data=await response.json() as {error?:string;verificationStatus?:string;id:string;notificationEmailStatus:string};if(!response.ok)throw new Error(data.error||'Unable to submit.');
   setSubmitted({name:String(payload.name),id:data.id,emailStatus:data.notificationEmailStatus});setSuccess(data.verificationStatus==='registry_match'?'The official record matched. Your suggestion is now waiting for owner approval.':'Your suggestion was received and is waiting for an official-source review.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to submit.');}finally{setBusy(false);setAttempt(v=>v+1);}
 }
 if(submitted)return <section className="listing-waiting-panel" role="status"><span className="listing-waiting-icon" aria-hidden="true"><img src="/waiting-clock.svg" alt=""/></span><p className="section-kicker">SUBMISSION RECEIVED</p><h2>Waiting For Approval</h2><p><strong>{submitted.name}</strong> has been submitted for administrator review.</p><p>Your submission is saved. It will be checked against the official record before publication.</p>{submitted.emailStatus==='accepted'?<p className="record-note">The administrator notification was accepted by our email provider.</p>:<p className="record-note">The administrator email is pending delivery. Your submission remains saved for review.</p>}<a className="outline-button" href="/#attorney-search">Back To Attorney Search</a></section>;
 return <section className="listing-intake">
  {!ownershipRequest&&<div className="listing-kind-tabs" role="tablist" aria-label="Listing type"><button type="button" role="tab" aria-selected={kind==='lawyer'} onClick={()=>choose('lawyer')}>Add a lawyer</button><button type="button" role="tab" aria-selected={kind==='firm'} onClick={()=>choose('firm')}>Add a firm</button></div>}
  {kind==='lawyer'&&initialFirm&&<p className="listing-firm-context">Adding a lawyer to <strong>{initialFirm}</strong>. The firm details are prefilled below.</p>}
  <form key={kind} ref={formRef} className="listing-form listing-guided-form" noValidate onSubmit={submit}>
   <nav className="listing-step-nav" aria-label="Submission steps"><ol>{stepNames.map((name,index)=><li key={name}><button type="button" aria-current={step===index?'step':undefined} disabled={busy||photoPreparing} onClick={()=>goToStep(index)}><span className="listing-step-number">{index<step?'✓':index+1}</span><span>{name}</span></button></li>)}</ol><p>Reviewed before publication</p></nav>
   <div className="listing-step-content">
   <p className="listing-required-note"><span className="required-mark" aria-hidden="true">*</span> Required fields</p>
   <p className="listing-step-count" aria-live="polite">Step {step+1} of 3</p>
   <section className="listing-core-fields listing-step-panel" data-listing-step="0" hidden={step!==0} aria-labelledby="listing-core-heading"><h2 id="listing-core-heading" tabIndex={-1}>{kind==='lawyer'?'Who are you adding?':'Which firm are you adding?'}</h2><p className="listing-step-description">{kind==='lawyer'?'Start with the lawyer’s name and official record.':'Start with the firm’s name and location.'}</p>
   {kind==='lawyer'?<div className="listing-form-row listing-name-row"><label>First Name <span className="required-mark" aria-hidden="true">*</span><input name="firstName" required maxLength={90}/></label><label>Middle Name <span>(optional)</span><input name="middleName" maxLength={90}/></label><label>Last Name <span className="required-mark" aria-hidden="true">*</span><input name="lastName" required maxLength={90}/></label></div>:<label>Firm’s full legal name <span className="required-mark" aria-hidden="true">*</span><input name="name" required maxLength={180} autoComplete="organization"/></label>}
   {kind==='lawyer'&&<><ListingPracticePicker value={practiceAreas} onChange={setPracticeAreas}/><LanguagePicker value={languages} onChange={setLanguages} disabled={busy}/></>}
   <div className="listing-form-row"><label>State <span className="required-mark" aria-hidden="true">*</span><select name="state" required value={state} onChange={e=>{setState(e.target.value);setCity('');}}><option value="" disabled>Select a state</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><CityAutocomplete state={state} value={city} onChange={setCity} required/></div>
   {kind==='lawyer'&&<div className="listing-website-field listing-bar-field"><div className="listing-website-heading"><label htmlFor="listing-official-source">Official state bar membership link <span className="required-mark" aria-hidden="true">*</span></label><span className="listing-website-help listing-bar-help"><button type="button" aria-label="What is the official state bar membership link?" aria-expanded={barHelpOpen} aria-controls="listing-bar-tip" onClick={()=>setBarHelpOpen(open=>!open)} onBlur={()=>setBarHelpOpen(false)} onKeyDown={event=>{if(event.key==='Escape')setBarHelpOpen(false);}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5"/><path d="M12 17h.01"/></svg></button><span id="listing-bar-tip" role="note" hidden={!barHelpOpen}>This is the link to the lawyer’s individual membership profile on their state bar or official attorney licensing website. Search for the lawyer in that website’s attorney directory, open their profile, and paste its link here.</span></span></div><input id="listing-official-source" name="officialSourceUrl" type="url" required aria-describedby="listing-bar-hint" onInvalid={e=>{if(kind==='lawyer')e.currentTarget.setCustomValidity(e.currentTarget.validity.valueMissing?'Please add the official state bar membership link.':'Please enter a valid official state bar membership link.');}} onInput={e=>e.currentTarget.setCustomValidity('')} placeholder="https://" maxLength={700}/><small id="listing-bar-hint">Paste the link to the lawyer’s individual profile in the official directory.</small></div>}
   </section><section className="listing-extra-fields listing-step-panel" data-listing-step="1" hidden={step!==1} aria-labelledby="listing-professional-heading"><h2 id="listing-professional-heading" tabIndex={-1}>Professional details</h2><p className="listing-step-description">{kind==='firm'?'Complete the required firm details below.':'Add any details you know.'}</p>
   {kind==='lawyer'&&<div className="listing-form-row"><label>Law Firm or Organization<input name="firmName" defaultValue={initialFirm} maxLength={200} placeholder="Firm name, if applicable"/></label><label>Law Firm Website<input name="firmWebsite" defaultValue={initialFirmWebsite} type="url" placeholder="https://" maxLength={500}/></label></div>}
   {kind==='lawyer'&&<><div className="listing-form-row"><label>Membership status <span className="required-mark" aria-hidden="true">*</span><select name="membershipStatus" required defaultValue="Member in Good Standing"><option>Member in Good Standing</option></select></label><label>State license or bar number (optional)<input name="barNumber" maxLength={80} inputMode="text"/></label></div><div className="listing-form-row"><label>Bar admission date <span>(optional)</span><input name="admitDate" type="date" max={new Date().toISOString().slice(0,10)}/></label><label>Law school <span>(optional)</span><input name="lawSchool" maxLength={180}/></label></div></>}
   {kind==='lawyer'&&<div className="listing-form-row"><label>Attorney phone number <span>(optional)</span><input name="phone" type="tel" onChange={formatPhoneEvent} maxLength={80} autoComplete="off" placeholder="123-456-7890"/></label><label>Attorney email <span>(optional)</span><input name="publicEmail" type="email" maxLength={254} autoComplete="off"/><small>Public contact email for this attorney.</small></label></div>}
   <div className="listing-form-row"><label>{kind==='lawyer'?'Attorney LinkedIn profile URL':'Firm LinkedIn page URL'} <span>(optional)</span><input name="linkedinUrl" type="url" placeholder={kind==='lawyer'?'https://www.linkedin.com/in/your-name/':'https://www.linkedin.com/company/your-firm/'} maxLength={500}/></label><div className="listing-website-field"><div className="listing-website-heading"><label htmlFor="listing-professional-website">{kind==='firm'?'Firm website':'Professional website'} {kind==='firm'?<span className="required-mark" aria-hidden="true">*</span>:<span>(optional)</span>}</label>{kind==='lawyer'&&<span className="listing-website-help"><button type="button" aria-label="About the professional website link" aria-expanded={websiteHelpOpen} aria-controls="listing-website-tip" aria-describedby="listing-website-tip" onClick={()=>setWebsiteHelpOpen(open=>!open)} onBlur={()=>setWebsiteHelpOpen(false)} onKeyDown={event=>{if(event.key==='Escape'){setWebsiteHelpOpen(false);event.currentTarget.blur();}}}>?</button><span id="listing-website-tip" role="tooltip" className={websiteHelpOpen?'is-open':''}>Paste the direct link to the lawyer’s About Me or biography page on their professional website.</span></span>}</div><input id="listing-professional-website" name="website" type="url" required={kind==='firm'} placeholder="https://" maxLength={500}/></div></div>
   {!ownershipRequest&&<label>Biography <span>(optional)</span><textarea name="biography" rows={5} maxLength={2500} placeholder={kind==='lawyer'?"Tell visitors about the lawyer’s background, experience, and approach to helping clients.":"Tell visitors about the firm, its experience, and the clients it serves. Separate paragraphs with a blank line."}/></label>}
   <ListingAddressFields state={state} city={city} kind={kind}/>
   {kind==='firm'&&<div className="listing-firm-photo"><div className="listing-form-row"><label>Firm phone number <span className="required-mark" aria-hidden="true">*</span><input name="phone" required type="tel" onChange={formatPhoneEvent} maxLength={80} placeholder="123-456-7890"/></label><label>Public firm email <span>(optional)</span><input name="publicEmail" type="email" maxLength={254}/></label></div><FirmImageUpload name="Law firm" file={photo} onChange={setPhoto} disabled={busy} existing={false}/></div>}{kind==='lawyer'&&<div className="listing-photo-upload"><PhotoFrameEditor staged disabled={busy} onChange={setPhoto} onBusy={setPhotoPreparing}/></div>}
   </section><section className="listing-submit-fields listing-step-panel" data-listing-step="2" hidden={step!==2} aria-labelledby="listing-submitter-heading"><h2 id="listing-submitter-heading" tabIndex={-1}>Your details</h2><p className="listing-step-description">Your name and email stay private.</p>
   <div className="listing-form-row"><label>Your first name <span className="required-mark" aria-hidden="true">*</span><input name="submitterFirstName" required maxLength={75} autoComplete="given-name"/></label><label>Your last name <span className="required-mark" aria-hidden="true">*</span><input name="submitterLastName" required maxLength={75} autoComplete="family-name"/></label></div><div className="listing-submitter-email"><label>{ownershipRequest?'Your firm email':'Your email'} <span className="required-mark" aria-hidden="true">*</span><input name="submitterEmail" type="email" required maxLength={254} autoComplete="email"/></label></div>
   {(kind==='lawyer'||ownershipRequest)&&<label>{ownershipRequest?'Your role and proof of authority':'Helpful notes'}{ownershipRequest?<span className="required-mark" aria-hidden="true">*</span>:<span>(optional)</span>}<textarea required={ownershipRequest} minLength={ownershipRequest?20:undefined} name="notes" rows={2} maxLength={2500} placeholder="Anything that will help us confirm the listing"/></label>}
   <p className="record-note">Attorney and firm contact details appear publicly after approval.</p>
   {step===2&&<DirectoryCaptcha key={kind} attempt={attempt} required onReady={setCaptchaReady}/>}
   </section>
   <label className="submission-honeypot" aria-hidden="true">Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off"/></label>
   {error&&<p className="directory-error" role="alert">{error}</p>}{success&&<p className="success-message" role="status">{success}</p>}
   <div className="listing-step-actions"><button className="outline-button" type="button" disabled={step===0||busy||photoPreparing} onClick={()=>goToStep(step-1)}>Back</button>{step<2?<button className="gold-button" type="button" disabled={busy||photoPreparing} onClick={()=>goToStep(step+1)}>Continue</button>:<button className="gold-button" type="submit" disabled={busy||photoPreparing||!captchaReady}>{busy?'Checking official source…':ownershipRequest?'Submit ownership review request':`Submit ${kind} for review`}</button>}</div>
   </div>
  </form>
 </section>;
}
