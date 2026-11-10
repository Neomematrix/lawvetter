'use client';
import LanguagePicker from '../LanguagePicker';
import ProfessionalWorkspaceSwitch from '../ProfessionalWorkspaceSwitch';
import WebsiteBadgePanel from '../WebsiteBadgePanel';
import ChangeLoginEmail from '../ChangeLoginEmail';
import ActivityPanel from '../ActivityPanel';
import PhotoFrameEditor from '../PhotoFrameEditor';
import AttorneyReferrals,{type ReferralMetrics} from './AttorneyReferrals';
import {attorneyPath} from '../seo';
import VerifiedOwnershipBadge from '../VerifiedOwnershipBadge';
import {displayBarNumber} from '../attorney-identity';
import NewAttorneyProfile from './NewAttorneyProfile';
import ClaimProfile,{type ProfileState} from '../ClaimProfile';
import SiteHeader from '../SiteHeader';
import {practiceAreas} from '../practice-catalog';
import {FormEvent,useEffect,useState,useRef} from 'react';
import {profileRequest} from '../profile-request';
import type {PublicProfile} from '../ClaimProfile';

type Owned=PublicProfile&{hide_bar_number?:number;name:string;company:string;state?:string;license_number?:string|null};
type Account={profiles:Owned[];claims:{bar_number:string;status:string;review_note:string;name:string}[];isAdmin:boolean;submissions:{id:string;name:string;bar_number:string;status:string;review_note:string}[]};

export default function AttorneyAccount({onLogout,logoutBusy}:{onLogout:()=>void;logoutBusy:boolean}){
 const [data,setData]=useState<Account|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<Owned|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [hasFirm,setHasFirm]=useState(false);
 const [section,setSection]=useState<'profile'|'analytics'|'inbox'|'settings'>('profile');
 const sectionTitle=section==='profile'?'My profile':section==='analytics'?'Analytics':section==='inbox'?'Inbox':'Account settings';
 useEffect(()=>{const c=new AbortController();fetch('/api/firm-management',{cache:'no-store',signal:c.signal}).then(async r=>{if(r.ok){const d=await r.json() as {firms?:unknown[]};if(!c.signal.aborted)setHasFirm(!!d.firms?.length);}}).catch(()=>{});return()=>c.abort();},[]);
 const [referralMetrics,setReferralMetrics]=useState<ReferralMetrics|null>(null);
 const [editing,setEditing]=useState(false);
 const [analytics,setAnalytics]=useState<{profiles:{bar_number:string;monthlyRank:number|null;views:number}[];monthLabel:string}|null>(null);
 const profileEditor=useRef<HTMLElement>(null);
 const claimSection=useRef<HTMLDivElement>(null);
 const [claimLoading,setClaimLoading]=useState('');
 const [query,setQuery]=useState(''),[matches,setMatches]=useState<{bar_number:string;name:string;city:string;state?:string;license_number?:string|null}[]>([]),[searchBusy,setSearchBusy]=useState(false),[searched,setSearched]=useState(false),[claimTarget,setClaimTarget]=useState<{bar:string;name:string;state:ProfileState}|null>(null),[newProfile,setNewProfile]=useState(false);
 async function search(e:FormEvent){e.preventDefault();setClaimTarget(null);setNewProfile(false);setSearchBusy(true);setError('');try{const r=await fetch('/api/attorneys?q='+encodeURIComponent(query)+'&statusGroup=all'),d=await r.json() as {error?:string;attorneys?:{bar_number:string;name:string;city:string;state?:string;license_number?:string|null}[];attorney?:{name:string}};if(!r.ok)throw Error(d.error||'Search failed.');setMatches(d.attorneys||[]);setSearched(true);}catch(e){setError(e instanceof Error?e.message:'Search failed.');}finally{setSearchBusy(false);}}
 async function chooseClaim(bar:string,name:string){setClaimLoading(bar);setError('');try{const state=await profileRequest<ProfileState>({action:'view',bar});setClaimTarget({bar,name,state});setNewProfile(false);}catch(e){setError(e instanceof Error?e.message:'Unable to load this profile.');}finally{setClaimLoading('');}}
 async function load(){
  try{
   const x=await profileRequest<Account>({action:'account'});
   setData(x);setError('');if(x.profiles.length)setClaimTarget(null);
   const bar=new URLSearchParams(window.location.search).get('bar');
   setSelected(current=>x.profiles.find(p=>p.bar_number===(bar||current?.bar_number))||x.profiles[0]||null);if(x.profiles.length){const r=await fetch('/api/account/analytics',{credentials:'include',cache:'no-store'});if(r.ok)setAnalytics(await r.json());}if(bar&&!x.profiles.length){const r=await fetch('/api/attorneys?id='+encodeURIComponent(bar)),d=await r.json() as {error?:string;attorneys?:{bar_number:string;name:string;city:string;state?:string;license_number?:string|null}[];attorney?:{name:string}};if(d.attorney)await chooseClaim(bar,d.attorney.name);}
  }catch(e){setError(e instanceof Error?e.message:'Unable to load your account.');}
 }
 useEffect(()=>{load();},[]);
 useEffect(()=>{if(editing||!data?.claims.some(c=>c.status==='pending'))return;const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[editing,data?.claims.some(c=>c.status==='pending')]);
 useEffect(()=>{setReferralMetrics(null);},[selected?.bar_number]);
 useEffect(()=>{if(!message)return;const timer=window.setTimeout(()=>setMessage(''),5000);return()=>window.clearTimeout(timer);},[message]);
 useEffect(()=>{if(claimTarget)claimSection.current?.scrollIntoView({block:'start',behavior:'smooth'});},[claimTarget?.bar]);
 async function save(e:FormEvent){
  e.preventDefault();if(!selected)return;setBusy(true);setMessage('');setError('');
  try{await profileRequest({action:'save',bar:selected.bar_number,headline:selected.headline,bio:selected.bio,practiceAreas:selected.practice_areas,languages:selected.languages??'',website:selected.website,linkedinUrl:selected.linkedin_url??'',hideBarNumber:true});await load();setEditing(false);setMessage('Profile saved.');requestAnimationFrame(()=>profileEditor.current?.scrollIntoView({block:'start',behavior:'smooth'}));}
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
 return <main><SiteHeader/><div className={'page-shell account-page attorney-account-workspace'+(selected?' client-review-account client-slim-workspace lawyer-sidebar-workspace':'')}>
  {!selected&&<header className="attorney-workspace-heading"><div><p className="section-kicker">YOUR PROFESSIONAL WORKSPACE</p><h1>Dashboard</h1><p>Manage your profile, connect with clients, and follow your activity.</p></div></header>}
  {hasFirm&&<ProfessionalWorkspaceSwitch active="attorney"/>}
  {selected&&<aside className="client-workspace-sidebar"><p className="client-workspace-label">YOUR SPACE</p><nav aria-label="Your lawyer account">{([{id:'profile',label:'My profile'},{id:'analytics',label:'Analytics'},{id:'inbox',label:'Inbox'}] as const).map(item=><button key={item.id} type="button" aria-current={section===item.id?'page':undefined} aria-controls="my-lawyer-content" onClick={()=>setSection(item.id)}>{item.label}</button>)}</nav><div className="client-workspace-sidebar-bottom"><button type="button" aria-current={section==='settings'?'page':undefined} aria-controls="my-lawyer-content" onClick={()=>setSection('settings')}>Account settings</button></div><WebsiteBadgePanel key={selected.bar_number} name={selected.name} path={attorneyPath(selected)}/></aside>}
  <section id="my-lawyer-content" className={selected?'client-workspace-main':'attorney-badge-main'} aria-labelledby={selected?'my-lawyer-title':undefined}>
  {selected&&<header className="client-workspace-heading"><div><p className="client-workspace-welcome">Your professional workspace</p><h1 id="my-lawyer-title">{sectionTitle}</h1></div><a className="gold-button" href={attorneyPath(selected)}>View lawyer page</a></header>}
  {error&&<div className="directory-error" role="alert">{error} {!data&&<a href="/signin-with-chatgpt?return_to=%2Faccount" target="_top">Sign in</a>} <button onClick={load}>Try again</button></div>}
  {message&&<p className="dashboard-save-message" role="status">{message}</p>}{!data&&!error&&<p role="status">Loading your dashboard…</p>}

  {selected&&<div id="my-lawyer-analytics" className="workspace-anchor" hidden={section!=='analytics'}><ActivityPanel kind="attorney" target={selected.bar_number}/></div>}
  {data&&<><div hidden={!!selected&&section!=='profile'}>{selected&&data.claims.some(c=>c.bar_number===selected.bar_number&&c.status==='approved')&&<div className="dashboard-save-message" role="status"><strong>Your profile claim is approved.</strong> You can now manage your attorney profile using your existing account. Select Edit profile below.</div>}{selected&&<div className="attorney-workspace-stats"><article><span>Managed profiles</span><strong>{data.profiles.length}</strong><small>Editing enabled after approval</small></article><article><span>Client referrals</span><strong>{referralMetrics?.total??'…'}</strong><small>Requests to your selected profile</small></article><article><span>New messages</span><strong>{referralMetrics?.unread??'…'}</strong><small>Unread client referrals</small></article></div>}{data.profiles.length>1&&<label>Choose a profile<select value={selected?.bar_number} onChange={e=>setSelected(data.profiles.find(p=>p.bar_number===e.target.value)||null)}>{data.profiles.map(p=><option key={p.bar_number} value={p.bar_number}>{p.name}</option>)}</select></label>}

  {selected?<section id="my-lawyer-profile" className={'profile-editor'+(!editing?' compact-profile-strip':'')} ref={profileEditor}>
   <div className="editor-heading"><div><h2>{selected.name}</h2><VerifiedOwnershipBadge compact={!editing}/><p>{selected.state||'GA'} {displayBarNumber(selected.license_number??selected.bar_number)}{selected.company?' · '+selected.company:''}</p><a href={attorneyPath(selected)}>View your public profile</a></div>{!editing&&<button type="button" className="gold-button" onClick={()=>{setMessage('');setEditing(true);}}>Edit profile</button>}</div>
   {editing?<><div className="photo-editor">{selected.photo_key?<img src={'/api/profile-photo?bar='+selected.bar_number+'&v='+encodeURIComponent(selected.photo_key)} alt="Your profile photo"/>:<div className="photo-placeholder">Your photo</div>}<PhotoFrameEditor key={selected.bar_number} disabled={busy} onChange={file=>{if(file)void photo(file);}}/></div>
   <form onSubmit={save}>
    <p className="record-note">Bar numbers are hidden on all public profiles. Your number remains on file for verification and searches.</p>
    <label>Professional headline<input maxLength={160} value={selected.headline} onChange={e=>setSelected({...selected,headline:e.target.value})} placeholder="A short introduction to your practice"/></label>
    <label>About you<textarea rows={7} maxLength={5000} value={selected.bio} onChange={e=>setSelected({...selected,bio:e.target.value})} placeholder="Describe your experience and approach"/></label>
    <fieldset className="practice-choices"><legend>Practice areas for discovery</legend><p>Select the areas you practice so people can find your profile.</p>{practiceAreas.map(area=>{const values=selected.practice_areas.split(',').map(v=>v.trim()).filter(Boolean),checked=values.some(v=>v.toLowerCase()===area.name.toLowerCase());return <label key={area.id}><input type="checkbox" checked={checked} onChange={()=>setSelected({...selected,practice_areas:(checked?values.filter(v=>v.toLowerCase()!==area.name.toLowerCase()):[...values,area.name]).join(', ')})}/>{area.name}</label>;})}</fieldset>
    <label>Practice areas and other specialties (comma separated)<input maxLength={500} value={selected.practice_areas} onChange={e=>setSelected({...selected,practice_areas:e.target.value})} placeholder="For example: Family law, mediation"/></label>
    <LanguagePicker value={selected.languages??''} onChange={languages=>setSelected({...selected,languages})} disabled={busy}/>
    <label>Professional website<input type="url" maxLength={500} value={selected.website} onChange={e=>setSelected({...selected,website:e.target.value})} placeholder="https://yourfirm.com"/></label>
    <label>LinkedIn profile URL<input type="url" maxLength={500} value={selected.linkedin_url??''} onChange={e=>setSelected({...selected,linkedin_url:e.target.value})} placeholder="https://www.linkedin.com/in/your-name/"/></label><p className="record-note">Your State Bar name, bar number, membership status, and other imported records are maintained separately.</p><button className="gold-button" disabled={busy}>{busy?'Saving…':'Save profile details'}</button><button type="button" className="outline-button" disabled={busy} onClick={()=>{setEditing(false);void load();}}>Cancel editing</button>
   </form></>:null}
  </section>:!claimTarget&&!newProfile?<div className="chart-empty"><div><h2>Make your profile your own.</h2><p>Search for your attorney record and choose “Claim this profile” to request free editing access.</p><a className="gold-button" href="#claim-profile-search">Find your profile</a></div></div>:null}
  </div>{selected&&<div id="my-lawyer-inbox" className="workspace-anchor" hidden={section!=='inbox'}><AttorneyReferrals key={selected.bar_number} bar={selected.bar_number} name={selected.name} onMetrics={setReferralMetrics}/></div>}
  <div hidden={!!selected&&section!=='profile'}>{data.profiles.length>0&&!hasFirm&&<div className="attorney-more-tools"><a className="outline-button" href="/firm-access">Request firm ownership review</a></div>}{!data.profiles.length&&<section id="claim-profile-search" className="attorney-onboarding"><p className="section-kicker">PROFILE OWNERSHIP</p><h2>Find and claim your profile</h2><p>Search your name or bar number. Ownership is verified before editing is enabled.</p><form className="attorney-profile-search" onSubmit={search}><label>Your Name or Bar Number<input required minLength={2} maxLength={150} value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="gold-button" disabled={searchBusy}>{searchBusy?'Searching…':'Find My Profile'}</button></form>{searched&&!matches.length&&<p>No matching profile found. You can submit a new profile below.</p>}{matches.map(a=><article className="attorney-claim-result" key={a.bar_number}><div><strong>{a.name}</strong><p>{a.state||'GA'} {displayBarNumber(a.license_number??a.bar_number)} · {a.city}</p></div><button type="button" className="gold-button" aria-pressed={claimTarget?.bar===a.bar_number} disabled={!!claimLoading} onClick={()=>chooseClaim(a.bar_number,a.name)}>{claimLoading===a.bar_number?'Loading profile…':claimTarget?.bar===a.bar_number?'Profile selected':'Claim this profile'}</button></article>)}{claimTarget&&<div className="attorney-account-claim" ref={claimSection}><ClaimProfile initialOpen key={claimTarget.bar} bar={claimTarget.bar} name={claimTarget.name} state={claimTarget.state} onRefresh={()=>{chooseClaim(claimTarget.bar,claimTarget.name);load();}}/>{claimTarget.state.profile?.claimed_at&&!claimTarget.state.isOwner&&<p>This profile is already claimed. Contact LawVetter to resolve ownership.</p>}</div>}<p className="attorney-new-profile-action">Not listed? <button className="outline-button" type="button" onClick={()=>setNewProfile(v=>!v)}>{newProfile?'Close New Profile':'Create A New Profile'}</button></p></section>}{newProfile&&!data.profiles.length&&<NewAttorneyProfile onSaved={load}/>}
  {!!data.submissions?.length&&<section className="account-claims"><h2>Your Submitted Profiles</h2>{data.submissions.map(s=><article key={s.id}><h3>{s.name}</h3><p>{s.status==='pending'?'Awaiting licensing and identity verification':s.status==='published'?'Approved and published':s.status}</p>{s.review_note&&<p>{s.review_note}</p>}</article>)}</section>}{data.claims.length>0&&<details className="account-claims dashboard-claims-disclosure"><summary>Your claims <span>{data.claims.length}</span></summary>{data.claims.map(c=><article key={c.bar_number}><h3><a href={'/attorney?bar='+c.bar_number}>{c.name}</a></h3><p className="claim-status">{c.status}</p>{c.review_note&&<p>{c.review_note}</p>}</article>)}</details>}</div></>}
  <div hidden={!!selected&&section!=='settings'}><ChangeLoginEmail/><footer className="dashboard-account-footer"><a href="/account/delete">Delete my account</a></footer>
 </div></section></div></main>;
}
