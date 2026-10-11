'use client';
import {createContext,useContext,useEffect,useState,ReactNode} from 'react';
import type {Attorney} from './GeorgiaDirectory';
type State={attorneys:Attorney[];loading:boolean;error:string;requiresSignIn:boolean;signedIn:boolean;pending:string[];toggle:(a:Attorney)=>Promise<void>;reload:()=>Promise<void>};
const Context=createContext<State|null>(null);
export function ShortlistProvider({children}:{children:ReactNode}){
 const [attorneys,setAttorneys]=useState<Attorney[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[requiresSignIn,setRequiresSignIn]=useState(false),[signedIn,setSignedIn]=useState(false),[pending,setPending]=useState<string[]>([]);
 async function request(action:string,bar?:string){
  const r=await fetch('/api/shortlist',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({action,bar})});
  if(r.status===401){setRequiresSignIn(true);setSignedIn(false);setAttorneys([]);if(action==='list')return;throw new Error('Log in to save and compare attorneys.');}
  if(!r.headers.get('Content-Type')?.includes('application/json'))throw new Error('Reopen CounselCheck to access your shortlist.');
  const x=await r.json() as {error?:string;attorneys:Attorney[]};if(!r.ok)throw new Error(x.error||'Unable to load your shortlist.');setRequiresSignIn(false);setSignedIn(true);setAttorneys(x.attorneys);
 }
 async function reload(){setLoading(true);setError('');try{await request('list');}catch(e){setError(e instanceof Error?e.message:'Unable to load your shortlist.');}finally{setLoading(false);}}
 useEffect(()=>{reload();const refresh=()=>reload();window.addEventListener('client-auth-changed',refresh);return()=>window.removeEventListener('client-auth-changed',refresh);},[]);
 async function toggle(a:Attorney){if(pending.length)return;setPending([a.bar_number]);setError('');try{await request(attorneys.some(x=>x.bar_number===a.bar_number)?'remove':'save',a.bar_number);}catch(e){setError(e instanceof Error?e.message:'Unable to update your shortlist.');}finally{setPending([]);}}
 return <Context.Provider value={{attorneys,loading,error,requiresSignIn,signedIn,pending,toggle,reload}}>{children}</Context.Provider>;
}
export function useShortlist(){const value=useContext(Context);if(!value)throw new Error('Shortlist provider missing');return value;}
export function SaveAttorneyButton({attorney}:{attorney:Attorney}){
 const s=useShortlist(),saved=s.attorneys.some(a=>a.bar_number===attorney.bar_number);if(s.loading||!s.signedIn)return null;
 return <button className={'save-attorney '+(saved?'saved':'')} disabled={s.loading||s.pending.length>0} aria-pressed={saved} onClick={()=>s.toggle(attorney)}>{s.pending.includes(attorney.bar_number)?'Saving…':saved?'✓ Saved':'+ Shortlist'}</button>;
}
export function ShortlistNotice(){const s=useShortlist();return s.error&&s.signedIn?<div className="directory-error" role="alert">{s.error} <button onClick={s.reload}>Try again</button></div>:null;}
export function ShortlistNavLink(){const s=useShortlist();return s.signedIn?<a className="shortlist-nav" href="/?view=shortlist">Your shortlist <span>{s.attorneys.length}</span></a>:null;}
