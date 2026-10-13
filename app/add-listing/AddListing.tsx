'use client';
import DirectoryCaptcha from '../DirectoryCaptcha';
import CityAutocomplete from '../CityAutocomplete';
import {FormEvent,useEffect,useState} from 'react';

const states=[
 ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];
type Kind='lawyer'|'firm';
export default function AddListing(){
 const [state,setState]=useState('GA'),[city,setCity]=useState(''),[photo,setPhoto]=useState<File|null>(null),[preview,setPreview]=useState('');
 useEffect(()=>{if(!photo){setPreview('');return;}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);
 const [kind,setKind]=useState<Kind>('lawyer'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[attempt,setAttempt]=useState(0),[submitted,setSubmitted]=useState<{name:string;id:string;emailStatus:string}|null>(null);
 useEffect(()=>{const value=new URLSearchParams(window.location.search).get('type');if(value==='firm')setKind('firm');},[]);
 function choose(next:Kind){setKind(next);setError('');setSuccess('');setSubmitted(null);setPhoto(null);setCity('');window.history.replaceState(null,'','/add-listing?type='+next);}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setSuccess('');
  const formElement=event.currentTarget,form=new FormData(formElement),payload=Object.fromEntries(form.entries());
  try{
   delete payload.photo;delete payload.photoConsent;
   if(photo&&(!['image/jpeg','image/png'].includes(photo.type)||photo.size>3*1024*1024))throw new Error('Choose a JPEG or PNG photo smaller than 3 MB.');
   if(photo&&form.get('photoConsent')!=='on')throw new Error('Confirm you have permission to publish the photo.');
   if(kind==='lawyer'){
    const firstName=String(payload.firstName||'').trim(),middleName=String(payload.middleName||'').trim(),lastName=String(payload.lastName||'').trim();
    if(!firstName||!lastName)throw new Error('Enter the lawyer’s first and last name.');
    payload.name=[firstName,middleName,lastName].filter(Boolean).join(' ');
    if(String(payload.name).length>180)throw new Error('The lawyer’s full name must be 180 characters or fewer.');
    delete payload.firstName;delete payload.middleName;delete payload.lastName;
   }
   const upload=new FormData();upload.set('data',JSON.stringify({...payload,action:'submit',kind,photoConsent:!!photo}));if(kind==='lawyer'&&photo)upload.set('photo',photo);
   const response=await fetch('/api/directory-submissions',{method:'POST',credentials:'include',body:upload});
   const data=await response.json() as {error?:string;verificationStatus?:string;id:string;notificationEmailStatus:string};if(!response.ok)throw new Error(data.error||'Unable to submit.');
   setSubmitted({name:String(payload.name),id:data.id,emailStatus:data.notificationEmailStatus});setSuccess(data.verificationStatus==='registry_match'?'The official record matched. Your suggestion is now waiting for owner approval.':'Your suggestion was received and is waiting for an official-source review.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to submit.');}finally{setBusy(false);setAttempt(v=>v+1);}
 }
 if(submitted)return <section className="listing-waiting-panel" role="status"><span className="listing-waiting-icon" aria-hidden="true"><img src="/waiting-clock.svg" alt=""/></span><p className="section-kicker">SUBMISSION RECEIVED</p><h2>Waiting For Approval</h2><p><strong>{submitted.name}</strong> has been submitted for administrator review.</p><p>Your submission is saved. It will be checked against the official record before publication.</p>{submitted.emailStatus==='accepted'?<p className="record-note">The administrator notification was accepted by our email provider.</p>:<p className="record-note">The administrator email is pending delivery. Your submission remains saved for review.</p>}<a className="outline-button" href="/#attorney-search">Back To Attorney Search</a></section>;
 return <section className="listing-intake">
  <div className="listing-kind-tabs" role="tablist" aria-label="Listing type"><button type="button" role="tab" aria-selected={kind==='lawyer'} onClick={()=>choose('lawyer')}>Add a lawyer</button><button type="button" role="tab" aria-selected={kind==='firm'} onClick={()=>choose('firm')}>Add a firm</button></div>
  <aside className="verification-explainer"><strong>Verification required</strong><p>{kind==='lawyer'?'Provide the exact profile from the state bar, supreme court, or attorney-regulation directory. The system checks that page for the lawyer’s name and license number.':'Provide the firm’s official website or official attorney-roster page. Firms are reviewed through their site and licensed-attorney roster rather than a bar membership record.'}</p><span>Nothing is published automatically.</span></aside>
  <form key={kind} className="listing-form" onSubmit={submit}>
   {kind==='lawyer'?<div className="listing-form-row listing-name-row"><label>First Name<input name="firstName" required maxLength={90}/></label><label>Middle Name <span>(optional)</span><input name="middleName" maxLength={90}/></label><label>Last Name<input name="lastName" required maxLength={90}/></label></div>:<label>Firm’s full legal name<input name="name" required maxLength={180} autoComplete="organization"/></label>}
   {kind==='lawyer'&&<div className="listing-form-row"><label>Law Firm or Organization<input name="firmName" maxLength={180} placeholder="Firm name, if applicable"/></label><label>Law Firm Website<input name="firmWebsite" type="url" placeholder="https://" maxLength={500}/><small>After approval, this attorney joins the existing firm group or creates a new one.</small></label></div>}
   {kind==='lawyer'&&<label>Practice areas <span>(optional)</span><input name="practiceAreas" maxLength={500} placeholder="e.g., Family law, Personal injury"/><small>Enter one or more areas of law, separated by commas. Leave blank if unknown.</small></label>}
   <div className="listing-form-row"><label>State<select name="state" required value={state} onChange={e=>{setState(e.target.value);setCity('');}}>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><CityAutocomplete state={state} value={city} onChange={setCity}/></div>
   {kind==='lawyer'&&<label>State license or bar number<input name="barNumber" required maxLength={80} inputMode="text"/></label>}
   <label>{kind==='lawyer'?'Official state licensing record URL':'Official firm website or attorney roster URL'}<input name="officialSourceUrl" type="url" required placeholder="https://" maxLength={700}/><small>Paste the exact HTTPS page that identifies this lawyer or firm.</small></label>
   <label>Professional website <span>(optional)</span><input name="website" type="url" placeholder="https://" maxLength={500}/></label>
   {kind==='lawyer'&&<div className="listing-photo-upload"><label>Attorney Profile Photo <span>(optional)</span><input name="photo" type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>setPhoto(e.target.files?.[0]||null)}/><small>Browse for a JPEG or PNG, up to 3 MB. The administrator reviews the photo before it appears publicly.</small></label>{preview&&<img className="listing-photo-preview" src={preview} alt="Selected attorney profile photo preview"/>}{photo&&<label className="claim-attestation"><input name="photoConsent" type="checkbox" required/><span>I have permission to submit this photo for publication.</span></label>}</div>}
   <div className="listing-form-row"><label>Your name<input name="submitterName" required maxLength={150} autoComplete="name"/></label><label>Your email<input name="submitterEmail" type="email" required maxLength={254} autoComplete="email"/></label></div>
   <label>Helpful notes <span>(optional)</span><textarea name="notes" rows={4} maxLength={2500} placeholder="Anything that will help us confirm the listing"/></label>
   <label className="submission-honeypot" aria-hidden="true">Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off"/></label>
   <p className="record-note">Your contact information is used only to review this suggestion and is never shown on the public listing.</p>
   <DirectoryCaptcha key={kind} attempt={attempt}/>{error&&<p className="directory-error" role="alert">{error}</p>}{success&&<p className="success-message" role="status">{success}</p>}
   <button className="gold-button" type="submit" disabled={busy}>{busy?'Checking official source…':`Submit ${kind} for review`}</button>
  </form>
 </section>;
}
