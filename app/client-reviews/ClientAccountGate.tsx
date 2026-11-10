'use client';
import {formatPhoneEvent} from '../phone-format';
import ChangeLoginEmail from '../ChangeLoginEmail';
import EmailAccessNotice from '../EmailAccessNotice';
import PasswordInput from '../PasswordInput';
import {clientPhone} from '../client-phone';
import {FormEvent,useEffect,useState} from 'react';
import DirectoryCaptcha from '../DirectoryCaptcha';
import ClientReviewAccount from './ClientReviewAccount';
import LawVetterReviewIntro from '../LawVetterReviewIntro';

type State={client:{email:string}|null;legacy?:{email:string}|null;passwordResetAvailable?:boolean};

export default function ClientAccountGate({bar,initialMode='login',integratedIntro=false}:{bar:string;initialMode?:'login'|'request-reset'|'reset-password';integratedIntro?:boolean}){
 const [rememberEmail,setRememberEmail]=useState(false);
 const rememberedEmailKey='lawvetter.rememberedClientEmail';
 function rememberChoice(checked:boolean){setRememberEmail(checked);if(!checked){try{localStorage.removeItem(rememberedEmailKey);}catch{}}}
 const [captchaToken,setCaptchaToken]=useState(''),[attempt,setAttempt]=useState(0);
 const [state,setState]=useState<State|null>(null),[mode,setMode]=useState<'login'|'register'|'set-password'|'request-reset'|'reset-password'>(initialMode),[error,setError]=useState(''),[busy,setBusy]=useState(false),[email,setEmail]=useState(''),[firstName,setFirst]=useState(''),[middleName,setMiddle]=useState(''),[lastName,setLast]=useState(''),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[currentPassword,setCurrent]=useState(''),[consent,setConsent]=useState(false),[changing,setChanging]=useState(false),[message,setMessage]=useState(''),[resetToken,setResetToken]=useState('');

 async function load(){
  const r=await fetch('/api/client-auth',{cache:'no-store',credentials:'include'});
  const d=await r.json() as State&{error?:string};
  if(!r.ok)throw new Error(d.error);
  setState(d);
  if(d.legacy&&initialMode==='login'&&!new URLSearchParams(window.location.search).get('reset')){setEmail(d.legacy.email);setMode('set-password');}
 }

 useEffect(()=>{
  if(initialMode==='login'){try{const saved=localStorage.getItem(rememberedEmailKey);if(saved){setEmail(saved);setRememberEmail(true);}}catch{}}
  const params=new URLSearchParams(window.location.search),token=params.get('reset')||'';
  if(initialMode==='reset-password'||token){setResetToken(token);setMode('reset-password');window.history.replaceState({},'',window.location.pathname);}
  else if(params.get('mode')==='register')setMode('register');
  load().catch(e=>setError(e.message));
 },[]);

 function flashError(text:string){setError(text);window.setTimeout(()=>setError(current=>current===text?'':current),4000);}
 function showLogin(keepMessage=false){setMode('login');setResetToken('');setPassword('');setConfirm('');setError('');if(!keepMessage)setMessage('');window.history.replaceState({},'','/client-reviews'+(bar?'?bar='+encodeURIComponent(bar):''));}

 async function submit(e:FormEvent){
  e.preventDefault();setError('');setMessage('');
  const action=changing?'change-password':mode==='request-reset'?'request-password-reset':mode;
  if(action!=='login'&&action!=='request-password-reset'&&password.length<9){flashError('Password must be at least 9 characters.');return;}
  if(action!=='login'&&action!=='request-password-reset'&&password!==confirm){flashError('Passwords do not match.');return;}
  setBusy(true);
  try{
   if(action==='register')clientPhone(phone,true);
   const r=await fetch('/api/client-auth',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,password,currentPassword,firstName,middleName,lastName,phone,...(action==='register'?{accountType:'client'}:{}),consent,token:resetToken,captchaToken})});
   const d=await r.json() as {error?:string;message?:string};
   if(!r.ok)throw new Error(d.error);
   if(action==='login'){try{if(rememberEmail)localStorage.setItem(rememberedEmailKey,email.trim());else localStorage.removeItem(rememberedEmailKey);}catch{}}
   if(action==='request-password-reset'){
    setMessage(d.message||'If a LawVetter account uses that email address, a password-reset link has been sent.');
    return;
   }
   if(action==='reset-password'){
    setState({client:null});setMessage('Your password has been reset. You can now log in.');window.dispatchEvent(new Event('client-auth-changed'));
    showLogin(true);
    return;
   }
   setPassword('');setConfirm('');setCurrent('');setChanging(false);
   await load();window.dispatchEvent(new Event('client-auth-changed'));
   if(action==='change-password')setMessage('Password changed. Other client sessions have been signed out.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');}
  finally{setBusy(false);setAttempt(v=>v+1);}
 }

 async function logout(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/client-auth',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
   if(!r.ok)throw new Error('Unable to log out. Please try again.');
   if(!rememberEmail)setEmail('');
   setState({client:null});setMode('login');setChanging(false);setPassword('');setMessage('');window.dispatchEvent(new Event('client-auth-changed'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to log out.');}
  finally{setBusy(false);}
 }

 const passwordFields=<><label>{changing?'New password':mode==='reset-password'?'New password':'Password'}<PasswordInput name="password" key={mode+String(changing)} autoComplete={mode==='login'&&!changing?'current-password':'new-password'} required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>{(mode!=='login'||changing)&&<label>Confirm password<PasswordInput name="confirmPassword" key={mode+'-confirm'} required autoComplete="new-password" maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}</>;

 if(!state)return <div className="page-shell"><p role={error?'alert':'status'}>{error||'Loading client account…'}</p>{error&&<button className="outline-button" onClick={()=>{setError('');load().catch(e=>setError(e.message));}}>Retry</button>}</div>;

 if(state.client&&mode!=='reset-password'&&mode!=='request-reset')return <><EmailAccessNotice/><ClientReviewAccount bar={bar} accountSettings={<>
  <ChangeLoginEmail/><div className="client-settings-identity"><h2>Your account</h2><p>{state.client.email}</p></div>
  {error&&<p className="directory-error" role="alert">{error}</p>}{message&&<p className="success-message" role="status">{message}</p>}
  <button type="button" className="outline-button" aria-expanded={changing} onClick={()=>{setChanging(!changing);setError('');setPassword('');setConfirm('');}}>{changing?'Cancel password change':'Change password'}</button>
  {changing&&<form className="client-review-form client-auth-panel" onSubmit={submit}><h2>Change password</h2><label>Current password<PasswordInput name="currentPassword" required autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label>{passwordFields}<button className="gold-button" disabled={busy}>Save password</button></form>}
  <div className="client-settings-delete"><a className="client-settings-delete-button" href="/account/delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>Delete my account</a></div>
 </>}/></>;

 const heading=mode==='register'?'Create your client account':mode==='set-password'?'Set your account password':mode==='request-reset'?'Reset your password':mode==='reset-password'?'Choose a new password':'Log in to LawVetter';
 const integrated=integratedIntro&&(mode==='login'||mode==='register'||mode==='set-password');
 return <div className={integrated?'page-shell review-account-layout':''}>{integrated&&<LawVetterReviewIntro compact headingLevel={1} id="review-account-intro"/>}<div className={integrated?'account-page review-account-form':'page-shell account-page'}>
  {integrated&&(mode==='login'||mode==='register')&&<div className="review-account-tabs" aria-label="Account options">{mode==='login'?<button type="button" onClick={()=>{setMode('register');setPassword('');setConfirm('');setError('');setMessage('');}}>Create account</button>:<button type="button" onClick={()=>showLogin()}>Already have an account? Log in</button>}</div>}
  <p className="section-kicker">CLIENT ACCOUNT</p><h1>{heading}</h1>
  {mode==='set-password'&&<p>Your existing profile and verification requests will stay with this account.</p>}
  {mode==='request-reset'&&<p>Enter the email address on your account. We will send a secure reset link if it matches a LawVetter account.</p>}
  {mode==='reset-password'&&<p>Create a new password for your LawVetter account. This link can be used once and expires after 30 minutes.</p>}
  {message&&<p className="success-message" role="status">{message}</p>}
  <form className="client-review-form client-auth-panel" onSubmit={submit}>
   {mode==='register'&&<div className="client-name-fields"><label>First name<input required autoComplete="given-name" maxLength={75} value={firstName} onChange={e=>setFirst(e.target.value)}/></label><label>Middle name (optional)<input autoComplete="additional-name" maxLength={75} value={middleName} onChange={e=>setMiddle(e.target.value)}/></label><label>Last name<input required autoComplete="family-name" maxLength={75} value={lastName} onChange={e=>setLast(e.target.value)}/></label></div>}
   {mode==='register'&&<label>Phone number<input name="phone" type="tel" autoComplete="tel" required maxLength={40} placeholder="123-456-7890" value={phone} onChange={e=>{formatPhoneEvent(e);setPhone(e.target.value);}}/><small className="record-note">Kept private with your account. It will not appear on public reviews.</small></label>}
   {mode!=='reset-password'&&<label>Email address<input type="email" autoComplete="username" required maxLength={254} value={mode==='set-password'?state.legacy?.email||email:email} readOnly={mode==='set-password'} onChange={e=>setEmail(e.target.value)}/></label>}
   {mode!=='request-reset'&&passwordFields}
   {mode==='login'&&<label className="claim-attestation"><input type="checkbox" checked={rememberEmail} onChange={e=>rememberChoice(e.target.checked)}/><span>Remember me<small style={{display:'block'}}>Save my email on this device.</small></span></label>}
   {mode==='login'&&<a className="forgot-password-link" href="/forgot-password">Forgot Password?</a>}
   {mode==='register'&&<><label className="claim-attestation"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to LawVetter storing my name, email, and phone number privately for account and verification purposes.</span></label><p className="record-note">No case number is needed to create an account. You will provide one only when requesting verification to review a specific attorney.</p></>}
   <DirectoryCaptcha key={mode} action="account_auth" attempt={attempt} onToken={setCaptchaToken}/>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   {mode==='login'?(integrated?<button className="gold-button" disabled={busy}>{busy?'Please wait…':'Log in'}</button>:<div className="client-auth-main-actions"><button type="button" className="create-account-button" onClick={()=>{setMode('register');setPassword('');setConfirm('');setError('');setMessage('');}}>Create a new account</button><button className="gold-button" disabled={busy}>{busy?'Please wait…':'Log in'}</button></div>):<button className="gold-button" disabled={busy}>{busy?'Please wait…':mode==='register'?'Create account':mode==='request-reset'?'Send reset link':mode==='reset-password'?'Save new password':'Save password and sign in'}</button>}
  </form>
  <div className="client-auth-options">
   {mode==='register'&&!integrated&&<button className="outline-button" onClick={()=>showLogin()}>Already registered? Log in</button>}
   {mode==='set-password'&&<button className="outline-button" onClick={()=>showLogin()}>Log in with an existing password</button>}
   {(mode==='request-reset'||mode==='reset-password')&&<button className="outline-button" onClick={()=>showLogin()}>Back to login</button>}
   {mode==='login'&&state.legacy&&<button className="outline-button" onClick={()=>setMode('set-password')}>Set password for my existing profile</button>}
  </div>
 </div></div>;
}
