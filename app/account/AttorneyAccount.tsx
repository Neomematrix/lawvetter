'use client';
import {displayBarNumber} from '../attorney-identity';
import NewAttorneyProfile from './NewAttorneyProfile';
import ClaimProfile,{type ProfileState} from '../ClaimProfile';
import SiteHeader from '../SiteHeader';
import {practiceAreas} from '../practice-areas';
import {FormEvent,useEffect,useState} from 'react';
import {profileRequest} from '../profile-request';
import type {PublicProfile} from '../ClaimProfile';

type Owned=PublicProfile&{name:string;company:string;state?:string};
type Account={profiles:Owned[];claims:{bar_number:string;status:string;review_note:string;name:string}[];isAdmin:boolean;submissions:{id:string;name:string;bar_number:string;status:string;review_note:string}[]};

export default function AttorneyAccount({onLogout,logoutBusy}:{onLogout:()=>void;logoutBusy:boolean}){
 const [data,setData]=useState<Account|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<Owned|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [query,setQuery]=useState(''),[matches,setMatches]=useState<{bar_number:string;name:string;city:string;state?:string}[]>([]),[searchBusy,setSearchBusy]=useState(false),[searched,setSearched]=useState(false),[claimTarget,setClaimTarget]=useState<{bar:string;name:string;state:ProfileState}|null>(null),[newProfile,setNewProfile]=useState(false);
 async function search(e:FormEvent){e.preventDefault();setSearchBusy(true);setError('');try{const r=await fetch('/api/attorneys?q='+encodeURIComponent(query)+'&statusGroup=all'),d=await r.json() as {error?:string;attorneys?:{bar_number:string;name:string;city:string;state?:string}[];attorney?:{name:string}};if(!r.ok)throw Error(d.error||'Search failed.');setMatches(d.attorneys||[]);setSearched(true);}catch(e){setError(e instanceof Error?e.message:'Search failed.');}finally{setSearchBusy(false);}}
 async function chooseClaim(bar:string,name:string){setError('');try{const state=await profileRequest<ProfileState>({action:'view',bar});setClaimTarget({bar,name,state});setNewProfile(false);}catch(e){setError(e instanceof Error?e.message:'Unable to load this profile.');}}
 async function load(){
  try{
   const x=await profileRequest<Account>({action:'account'});
   setData(x);setError('');
   const bar=new URLSearchParams(window.location.search).get('bar');
   setSelected(x.profiles.find(p=>p.bar_number===bar)||x.profiles[0]||null);if(bar&&!x.profiles.some(p=>p.bar_number===bar)){const r=await fetch('/api/attorneys?id='+encodeURIComponent(bar)),d=await r.json() as {error?:string;attorneys?:{bar_number:string;name:string;city:string;state?:string}[];attorney?:{name:string}};if(d.attorney)await chooseClaim(bar,d.attorney.name);}
  }catch(e){setError(e instanceof Error?e.message:'Unable to load your account.');}
 }
 useEffect(()=>{load();},[]);
 async function save(e:FormEvent){
  e.preventDefault();if(!selected)return;setBusy(true);setMessage('');setError('');
  try{await profileRequest({action:'save',bar:selected.bar_number,headline:selected.headline,bio:selected.bio,practiceAreas:selected.practice_areas,website:selected.website});setMessage('Profile details saved.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}
 }
 async function photo(file:File|undefined){
  if(!file||!selected)return;setBusy(true);setError('');setMessage('');
  try{
   if(!['image/jpeg','image/png'].includes(file.type)||file.size>3*1024*1024)throw new Error('Choose a JPEG or PNG photo smaller than 3 MB.');
   const form=new FormData();form.set('bar',selected.bar_number);form.set('photo',file);
   const r=await fetch('/api/profile-photo',{method:'POST',credentials:'include',body:form});
   const x=await r.json() as {error?:string;photoUrl:string};if(!r.ok)throw new Error(x.error||'Unable to upload your photo.');
   setSelected(current=>current&&current.bar_number===selected.bar_number?{...current,photo_key:new URL(x.photoUrl,window.location.origin).searchParams.get('v')||''}:current);
   setMessage('Profile photo uploaded.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to upload.');}finally{setBusy(false);}
 }
 return <main><SiteHeader/><div className="page-shell account-page">
  <p className="section-kicker">FOR ATTORNEYS · FREE PROFILE MANAGEMENT</p><h1>Your attorney account</h1>
  {error&&<div className="directory-error" role="alert">{error} {!data&&<a href="/signin-with-chatgpt?return_to=%2Faccount" target="_top">Sign in</a>} <button onClick={load}>Try again</button></div>}
  {message&&<p className="success-message" role="status">{message}</p>}{!data&&!error&&<p role="status">Loading your account…</p>}
  {data&&<><div className="form-actions"><button type="button" className="outline-button" disabled={logoutBusy} onClick={onLogout}>Log Out</button></div><section className="attorney-onboarding"><h2>Find And Claim Your Profile</h2><p>Search your name or bar number. Ownership is verified before editing is enabled.</p><form className="attorney-profile-search" onSubmit={search}><label>Your Name or Bar Number<input required minLength={2} maxLength={150} value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="gold-button" disabled={searchBusy}>{searchBusy?'Searching…':'Find My Profile'}</button></form>{searched&&!matches.length&&<p>No matching profile found. You can submit a new profile below.</p>}{matches.map(a=><article className="attorney-claim-result" key={a.bar_number}><div><strong>{a.name}</strong><p>{a.state||'GA'} #{displayBarNumber(a.bar_number)} · {a.city}</p></div><button className="outline-button" onClick={()=>chooseClaim(a.bar_number,a.name)}>Select Profile</button></article>)}{claimTarget&&<><h3>{claimTarget.name}</h3><ClaimProfile bar={claimTarget.bar} name={claimTarget.name} state={claimTarget.state} onRefresh={()=>{chooseClaim(claimTarget.bar,claimTarget.name);load();}}/>{claimTarget.state.profile?.claimed_at&&!claimTarget.state.isOwner&&<p>This profile is already claimed. Contact LawVetter to resolve ownership.</p>}</>}<p>Not listed? <button className="outline-button" type="button" onClick={()=>setNewProfile(v=>!v)}>{newProfile?'Close New Profile':'Create A New Profile'}</button></p></section>{newProfile&&<NewAttorneyProfile onSaved={load}/>}
  {data.profiles.length>1&&<label>Choose a profile<select value={selected?.bar_number} onChange={e=>setSelected(data.profiles.find(p=>p.bar_number===e.target.value)||null)}>{data.profiles.map(p=><option key={p.bar_number} value={p.bar_number}>{p.name}</option>)}</select></label>}
  {data.profiles.length>0&&<p><a className="outline-button" href="/account/analytics">My profile analytics</a></p>}
  {selected?<section className="profile-editor">
   <div className="editor-heading"><div><h2>{selected.name} <img className="claimed-badge" src="/claimed-profile-checkmark.svg" alt="Claimed profile"/></h2><p>{selected.state||'GA'} #{displayBarNumber(selected.bar_number)} · {selected.company}</p><a href={'/attorney?bar='+selected.bar_number}>View your public profile</a></div></div>
   <div className="photo-editor">{selected.photo_key?<img src={'/api/profile-photo?bar='+selected.bar_number+'&v='+encodeURIComponent(selected.photo_key)} alt="Your profile photo"/>:<div className="photo-placeholder">Your photo</div>}<label>Add or replace your profile photo<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>photo(e.target.files?.[0])}/><small>JPEG or PNG · maximum 3 MB · use a photo you have permission to publish.</small></label></div>
   <form onSubmit={save}>
    <label>Professional headline<input maxLength={160} value={selected.headline} onChange={e=>setSelected({...selected,headline:e.target.value})} placeholder="A short introduction to your practice"/></label>
    <label>About you<textarea rows={7} maxLength={5000} value={selected.bio} onChange={e=>setSelected({...selected,bio:e.target.value})} placeholder="Describe your experience and approach"/></label>
    <fieldset className="practice-choices"><legend>Practice areas for discovery</legend><p>Select the areas you practice so people can find your profile.</p>{practiceAreas.map(area=>{const values=selected.practice_areas.split(',').map(v=>v.trim()).filter(Boolean),checked=values.some(v=>v.toLowerCase()===area.name.toLowerCase());return <label key={area.id}><input type="checkbox" checked={checked} onChange={()=>setSelected({...selected,practice_areas:(checked?values.filter(v=>v.toLowerCase()!==area.name.toLowerCase()):[...values,area.name]).join(', ')})}/>{area.name}</label>;})}</fieldset>
    <label>Practice areas and other specialties (comma separated)<input maxLength={500} value={selected.practice_areas} onChange={e=>setSelected({...selected,practice_areas:e.target.value})} placeholder="For example: Family law, mediation"/></label>
    <label>Professional website<input type="url" maxLength={500} value={selected.website} onChange={e=>setSelected({...selected,website:e.target.value})} placeholder="https://yourfirm.com"/></label>
    <p className="record-note">Your State Bar name, bar number, membership status, and other imported records are maintained separately.</p><button className="gold-button" disabled={busy}>{busy?'Saving…':'Save profile details'}</button>
   </form>
  </section>:<div className="chart-empty"><div><h2>Make your profile your own.</h2><p>Search for your attorney record and choose “Claim this profile” to request free editing access.</p><a className="gold-button" href="/#attorney-search">Find your profile</a></div></div>}
  {!!data.submissions?.length&&<section className="account-claims"><h2>Your Submitted Profiles</h2>{data.submissions.map(s=><article key={s.id}><h3>{s.name}</h3><p>{s.status==='pending'?'Awaiting licensing and identity verification':s.status==='published'?'Approved and published':s.status}</p>{s.review_note&&<p>{s.review_note}</p>}</article>)}</section>}{data.claims.length>0&&<section className="account-claims"><h2>Your claims</h2>{data.claims.map(c=><article key={c.bar_number}><h3><a href={'/attorney?bar='+c.bar_number}>{c.name}</a></h3><p className="claim-status">{c.status}</p>{c.review_note&&<p>{c.review_note}</p>}</article>)}</section>}</>}
 </div></main>;
}
