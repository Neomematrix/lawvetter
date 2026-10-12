'use client';
import {FormEvent,useEffect,useState} from 'react';
import ClientReviewAccount from './ClientReviewAccount';

type State={client:{email:string}|null;legacy?:{email:string}|null;passwordResetAvailable?:boolean};

export default function ClientAccountGate({bar}:{bar:string}){
 const [state,setState]=useState<State|null>(null),[mode,setMode]=useState('login'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[email,setEmail]=useState(''),[firstName,setFirst]=useState(''),[lastName,setLast]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[currentPassword,setCurrent]=useState(''),[consent,setConsent]=useState(false),[changing,setChanging]=useState(false),[message,setMessage]=useState(''),[resetToken,setResetToken]=useState('');

 async function load(){
  const r=await fetch('/api/client-auth',{cache:'no-store',credentials:'include'});
  const d=await r.json() as State&{error?:string};
  if(!r.ok)throw new Error(d.error);
  setState(d);
  if(d.legacy&&!new URLSearchParams(window.location.search).get('reset')){setEmail(d.legacy.email);setMode('set-password');}
 }

 useEffect(()=>{
  const params=new URLSearchParams(window.location.search),token=params.get('reset')||'';
  if(/^[a-f0-9]{64}$/.test(token)){setResetToken(token);setMode('reset-password');}
  else if(params.get('mode')==='register')setMode('register');
  load().catch(e=>setError(e.message));
 },[]);

 function flashError(text:string){setError(text);window.setTimeout(()=>setError(current=>current===text?'':current),4000);}
 function showLogin(keepMessage=false){setMode('login');setResetToken('');setPassword('');setConfirm('');setError('');if(!keepMessage)setMessage('');window.history.replaceState({},'',window.location.pathname+(bar?'?bar='+encodeURIComponent(bar):''));}

 async function submit(e:FormEvent){
  e.preventDefault();setError('');setMessage('');
  const action=changing?'change-password':mode==='request-reset'?'request-password-reset':mode;
  if(action!=='login'&&action!=='request-password-reset'&&password.length<9){flashError('Password must be at least 9 characters.');return;}
  if(action!=='login'&&action!=='request-password-reset'&&password!==confirm){flashError('Passwords do not match.');return;}
  setBusy(true);
  try{
   const r=await fetch('/api/client-auth',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,password,currentPassword,firstName,lastName,consent,token:resetToken})});
   const d=await r.json() as {error?:string;message?:string};
   if(!r.ok)throw new Error(d.error);
   if(action==='request-password-reset'){
    setMessage(d.message||'If a LawVetter account uses that email address, a password-reset link has been sent.');
    return;
   }
   if(action==='reset-password'){
    setMessage('Your password has been reset. You can now log in.');
    showLogin(true);
    return;
   }
   setPassword('');setConfirm('');setCurrent('');setChanging(false);
   await load();window.dispatchEvent(new Event('client-auth-changed'));
   if(action==='change-password')setMessage('Password changed. Other client sessions have been signed out.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');}
  finally{setBusy(false);}
 }

 async function logout(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/client-auth',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
   if(!r.ok)throw new Error('Unable to log out. Please try again.');
   setState({client:null});setMode('login');setChanging(false);setPassword('');setMessage('');window.dispatchEvent(new Event('client-auth-changed'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to log out.');}
  finally{setBusy(false);}
 }

 const passwordFields=<><label>{changing?'New password':mode==='reset-password'?'New password':'Password'}<input type="password" autoComplete={mode==='login'&&!changing?'current-password':'new-password'} required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>{(mode!=='login'||changing)&&<label>Confirm password<input type="password" required autoComplete="new-password" maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}</>;

 if(!state)return <div className="page-shell"><p role={error?'alert':'status'}>{error||'Loading client account…'}</p>{error&&<button className="outline-button" onClick={()=>{setError('');load().catch(e=>setError(e.message));}}>Retry</button>}</div>;

 if(state.client)return <><div className="page-shell client-session-bar"><p>Signed in as <strong>{state.client.email}</strong></p><div className="form-actions"><button className="outline-button" onClick={()=>{setChanging(!changing);setError('');setPassword('');setConfirm('');}}>Change password</button><button className="outline-button" disabled={busy} onClick={logout}>Log out</button></div>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{changing&&<form className="client-review-form" onSubmit={submit}><h2>Change password</h2><label>Current password<input type="password" required autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label>{passwordFields}<button className="gold-button" disabled={busy}>Save password</button></form>}</div><ClientReviewAccount bar={bar}/></>;

 const heading=mode==='register'?'Create your client account':mode==='set-password'?'Set your account password':mode==='request-reset'?'Reset your password':mode==='reset-password'?'Choose a new password':'Log in to LawVetter';
 return <div className="page-shell account-page">
  <p className="section-kicker">CLIENT ACCOUNT</p><h1>{heading}</h1>
  {mode==='set-password'&&<p>Your existing profile and verification requests will stay with this account.</p>}
  {mode==='request-reset'&&<p>Enter the email address on your account. We will send a secure reset link if it matches a LawVetter account.</p>}
  {mode==='reset-password'&&<p>Create a new password for your LawVetter account. This link can be used once and expires after 30 minutes.</p>}
  {message&&<p className="success-message" role="status">{message}</p>}
  <form className="client-review-form" onSubmit={submit}>
   {mode==='register'&&<div className="client-name-fields"><label>First name<input required autoComplete="given-name" maxLength={75} value={firstName} onChange={e=>setFirst(e.target.value)}/></label><label>Last name<input required autoComplete="family-name" maxLength={75} value={lastName} onChange={e=>setLast(e.target.value)}/></label></div>}
   {mode!=='reset-password'&&<label>Email address<input type="email" autoComplete="username" required maxLength={254} value={mode==='set-password'?state.legacy?.email||email:email} readOnly={mode==='set-password'} onChange={e=>setEmail(e.target.value)}/></label>}
   {mode!=='request-reset'&&passwordFields}
   {mode==='login'&&(state.passwordResetAvailable?<button type="button" className="forgot-password-link" onClick={()=>{setMode('request-reset');setError('');setMessage('');setPassword('');}}>Forgot password?</button>:<p className="record-note">Forgotten-password email recovery is not available yet.</p>)}
   {mode==='register'&&<><label className="claim-attestation"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to LawVetter storing my name and email privately for account and verification purposes.</span></label><p className="record-note">No case number is needed to create an account. You will provide one only when requesting verification to review a specific attorney.</p></>}
   {error&&<p role="alert">{error}</p>}
   {mode==='login'?<div className="client-auth-main-actions"><button className="gold-button" disabled={busy}>{busy?'Please wait…':'Log in'}</button><button type="button" className="create-account-button" onClick={()=>{setMode('register');setPassword('');setConfirm('');setError('');setMessage('');}}>Create a new account</button></div>:<button className="gold-button" disabled={busy}>{busy?'Please wait…':mode==='register'?'Create account':mode==='request-reset'?'Send reset link':mode==='reset-password'?'Save new password':'Save password and sign in'}</button>}
  </form>
  <div className="client-auth-options">
   {mode==='register'&&<button className="outline-button" onClick={()=>showLogin()}>Already registered? Log in</button>}
   {mode==='set-password'&&<button className="outline-button" onClick={()=>showLogin()}>Log in with an existing password</button>}
   {(mode==='request-reset'||mode==='reset-password')&&<button className="outline-button" onClick={()=>showLogin()}>Back to login</button>}
   {mode==='login'&&state.legacy&&<button className="outline-button" onClick={()=>setMode('set-password')}>Set password for my existing profile</button>}
  </div>
 </div>;
}
