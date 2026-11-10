'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
export default function ClientAccountNav(){
 const pathname=usePathname();
 const [signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const load=()=>{fetch('/api/client-auth',{credentials:'include',cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{client?:unknown}>:null).then(d=>setSignedIn(!!d?.client)).catch(()=>{});};load();window.addEventListener('client-auth-changed',load);return ()=>window.removeEventListener('client-auth-changed',load);},[]);
 async function logout(){setBusy(true);setError('');try{const r=await fetch('/api/client-auth',{method:'POST',credentials:'include',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw Error('Unable to log out. Please try again.');setSignedIn(false);window.dispatchEvent(new Event('client-auth-changed'));window.location.assign('/');}catch{setError('Unable to log out. Please try again.');setBusy(false);}}
 return <><a className={'attorney-account-link client-login-link'+(signedIn?' dashboard-nav-link':'')} href={signedIn?'/dashboard':'/client-reviews'} aria-current={signedIn&&(pathname==='/dashboard'||pathname?.startsWith('/client-reviews'))?'page':undefined}>{signedIn&&<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="1.5"/><rect x="12" y="2" width="6" height="6" rx="1.5"/><rect x="2" y="12" width="6" height="6" rx="1.5"/><rect x="12" y="12" width="6" height="6" rx="1.5"/></svg>}{signedIn?'Dashboard':'Login'}</a>{signedIn&&<button type="button" className="header-logout" disabled={busy} onClick={logout}>{busy?'Logging out…':'Log out'}</button>}{error&&<span className="header-auth-error" role="alert">{error}</span>}</>;
}
