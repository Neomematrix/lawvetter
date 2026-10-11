'use client';
import {FormEvent,useEffect,useState} from 'react';

const states=[
 ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];
type Kind='lawyer'|'firm';
export default function AddListing(){
 const [kind,setKind]=useState<Kind>('lawyer'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 useEffect(()=>{const value=new URLSearchParams(window.location.search).get('type');if(value==='firm')setKind('firm');},[]);
 function choose(next:Kind){setKind(next);setError('');setSuccess('');window.history.replaceState(null,'','/add-listing?type='+next);}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setSuccess('');
  const formElement=event.currentTarget,form=new FormData(formElement),payload=Object.fromEntries(form.entries());
  try{
   const response=await fetch('/api/directory-submissions',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,action:'submit',kind})});
   const data=await response.json() as {error?:string;verificationStatus?:string};if(!response.ok)throw new Error(data.error||'Unable to submit.');
   formElement.reset();setSuccess(data.verificationStatus==='registry_match'?'The official record matched. Your suggestion is now waiting for owner approval.':'Your suggestion was received and is waiting for an official-source review.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to submit.');}finally{setBusy(false);}
 }
 return <section className="listing-intake">
  <div className="listing-kind-tabs" role="tablist" aria-label="Listing type"><button type="button" role="tab" aria-selected={kind==='lawyer'} onClick={()=>choose('lawyer')}>Add a lawyer</button><button type="button" role="tab" aria-selected={kind==='firm'} onClick={()=>choose('firm')}>Add a firm</button></div>
  <aside className="verification-explainer"><strong>Verification required</strong><p>{kind==='lawyer'?'Provide the exact profile from the state bar, supreme court, or attorney-regulation directory. The system checks that page for the lawyer’s name and license number.':'Provide the firm’s official website or official attorney-roster page. Firms are reviewed through their site and licensed-attorney roster rather than a bar membership record.'}</p><span>Nothing is published automatically.</span></aside>
  <form key={kind} className="listing-form" onSubmit={submit}>
   <label>{kind==='lawyer'?'Lawyer’s full legal name':'Firm’s full legal name'}<input name="name" required maxLength={180} autoComplete="organization"/></label>
   {kind==='lawyer'&&<label>Law firm or organization<input name="firmName" maxLength={180}/></label>}
   <div className="listing-form-row"><label>State<select name="state" required defaultValue="GA">{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><label>City<input name="city" maxLength={120}/></label></div>
   {kind==='lawyer'&&<label>State license or bar number<input name="barNumber" required maxLength={80} inputMode="text"/></label>}
   <label>{kind==='lawyer'?'Official state licensing record URL':'Official firm website or attorney roster URL'}<input name="officialSourceUrl" type="url" required placeholder="https://" maxLength={700}/><small>Paste the exact HTTPS page that identifies this lawyer or firm.</small></label>
   <label>Professional website <span>(optional)</span><input name="website" type="url" placeholder="https://" maxLength={500}/></label>
   <div className="listing-form-row"><label>Your name<input name="submitterName" required maxLength={150} autoComplete="name"/></label><label>Your email<input name="submitterEmail" type="email" required maxLength={254} autoComplete="email"/></label></div>
   <label>Helpful notes <span>(optional)</span><textarea name="notes" rows={4} maxLength={2500} placeholder="Anything that will help us confirm the listing"/></label>
   <label className="submission-honeypot" aria-hidden="true">Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off"/></label>
   <p className="record-note">Your contact information is used only to review this suggestion and is never shown on the public listing.</p>
   {error&&<p className="directory-error" role="alert">{error}</p>}{success&&<p className="success-message" role="status">{success}</p>}
   <button className="gold-button" type="submit" disabled={busy}>{busy?'Checking official source…':`Submit ${kind} for review`}</button>
  </form>
 </section>;
}
