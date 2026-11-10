'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
type Status={active:boolean;expired?:boolean;user?:{name:string;email:string}|null};
export default function ViewAsBanner(){
 const path=usePathname(),[status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let alive=true;async function check(){try{const r=await fetch('/api/admin/view-as?status=1',{cache:'no-store'});if(!r.ok)return;const d=await r.json() as Status;if(alive)setStatus(d);}catch{}}void check();const timer=setInterval(check,60000);window.addEventListener('focus',check);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',check);};},[path]);
 async function stop(){setBusy(true);setError('');try{const r=await fetch('/api/admin/view-as',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop'})}),d=await r.json() as {error?:string;redirect:string};if(!r.ok)throw Error(d.error||'Unable to return to admin.');window.location.assign(d.redirect);}catch(e){setError(e instanceof Error?e.message:'Unable to return to admin.');setBusy(false);}}
 if(!status?.active&&!status?.expired)return null;
 return <aside className="view-as-banner" aria-label="Viewing as user"><div><strong>{status.active?'Viewing as '+status.user?.name:'User view expired'}</strong>{status.active&&<span>{status.user?.email} · Actions save to this account.</span>}{error&&<span role="alert">{error}</span>}</div><button onClick={stop} disabled={busy}>{busy?'Returning…':'Return to admin'}</button></aside>;
}
