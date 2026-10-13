'use client';
import {useEffect,useState} from 'react';
export default function ClientAccountNav(){
 const [signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const load=()=>{fetch('/api/client-auth',{credentials:'include',cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{client?:unknown}>:null).then(d=>setSignedIn(!!d?.client)).catch(()=>{});};load();window.addEventListener('client-auth-changed',load);return ()=>window.removeEventListener('client-auth-changed',load);},[]);
 async function logout(){setBusy(true);setError('');try{const r=await fetch('/api/client-auth',{method:'POST',credentials:'include',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw Error('Unable to log out. Please try again.');setSignedIn(false);window.dispatchEvent(new Event('client-auth-changed'));window.location.assign('/');}catch{setError('Unable to log out. Please try again.');setBusy(false);}}
 return <><a className="attorney-account-link client-login-link" href="/client-reviews">{signedIn?'My client account':'Login'}</a>{signedIn&&<button type="button" className="header-logout" disabled={busy} onClick={logout}>{busy?'Logging out…':'Log Out'}</button>}{error&&<span className="header-auth-error" role="alert">{error}</span>}</>;
}
