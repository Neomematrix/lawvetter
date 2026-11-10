'use client';
import ProfileLanguages from './ProfileLanguages';
import {employmentLabel} from './employment';
import {recordDirectoryVisit} from './record-directory-visit';
import YearsInPractice from './YearsInPractice';
import {membershipStatus} from './membership-status';
import {practiceIcon} from './practice-icons';
import AttorneyReviewSummary from './AttorneyReviewSummary';
import OwnershipSeal from './OwnershipSeal';
import LinkedInLink from './LinkedInLink';
import {practiceCategoryId,splitPracticeAreas} from './practice-category';
import {practiceAreas as basePracticeAreas} from './practice-catalog';
import ClientReviews,{type ClientReviewPage} from './ClientReviews';
import {attorneyPhoto} from './attorney-photo';
import {useEffect,useRef,useState} from 'react';
import ClaimProfile,{type ProfileState} from './ClaimProfile';
import {profileRequest} from './profile-request';
import type { Attorney } from './GeorgiaDirectory';
import { SaveAttorneyButton } from './Shortlist';
import { FirmLink } from './FirmLink';
import {attorneyPath,absoluteUrl} from './seo';
function ActionIcon({kind}:{kind:'call'|'email'|'website'|'firm'}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='call'?<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z"/>:kind==='email'?<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>:kind==='website'?<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>:<><path d="m3 8 9-5 9 5H3ZM5 11v7m5-7v7m4-7v7m5-7v7M3 21h18"/></>}</svg>;
}
export default function AttorneyProfile({attorney,loading=false,headingLevel='h2',initialProfileState,initialReviews}:{attorney:Attorney;loading?:boolean;headingLevel?:'h1'|'h2';initialProfileState?:ProfileState;initialReviews?:ClientReviewPage}){
 const profileRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(headingLevel!=='h2')return;const frame=requestAnimationFrame(()=>profileRef.current?.scrollIntoView({block:'start',behavior:'instant'}));return()=>cancelAnimationFrame(frame);},[attorney.bar_number,headingLevel]);
 useEffect(()=>recordDirectoryVisit('attorney',attorney.bar_number),[attorney.bar_number]);
 useEffect(()=>{const old=window.history.state||{},eventId=old.profileViewBar===attorney.bar_number&&old.profileViewEvent?old.profileViewEvent:crypto.randomUUID();window.history.replaceState({...old,profileViewBar:attorney.bar_number,profileViewEvent:eventId},'',window.location.href);void fetch('/api/profile-views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bar:attorney.bar_number,eventId})}).catch(()=>{});},[attorney.bar_number]);
 const [state,setState]=useState<ProfileState|null>(initialProfileState||null),[profileError,setProfileError]=useState('');
 async function refresh(){setProfileError('');try{setState(await profileRequest<ProfileState>({action:'view',bar:attorney.bar_number}));}catch(e){setProfileError(e instanceof Error?e.message:'Unable to load claimed profile details.');}}
 useEffect(()=>{setState(initialProfileState||null);refresh();},[attorney.bar_number]);
 const [shareStatus,setShareStatus]=useState(''),[shareBusy,setShareBusy]=useState(false),[shareFallback,setShareFallback]=useState('');
 useEffect(()=>{setShareStatus('');setShareFallback('');},[attorney.bar_number]);
 async function shareProfile(){
  const url=absoluteUrl(attorneyPath(attorney));
  setShareBusy(true);setShareStatus('');setShareFallback('');
  try{
   if(navigator.share){
    try{await navigator.share({title:attorney.name+' | LawVetter',url});return;}
    catch(error){if(error instanceof Error&&error.name==='AbortError')return;}
   }
   try{await navigator.clipboard.writeText(url);setShareStatus('Profile link copied.');}
   catch{setShareFallback(url);setShareStatus('Copy the profile link below.');}
  }finally{setShareBusy(false);}
 }
 const currentFirm=(attorney.company||'').trim();
 const attorneyWebsite=state?.profile?.website||attorney.biography_website;
 const lawFirmEmployment=!attorney.employment_type||attorney.employment_type==='Law Firm Attorney';
 const website=lawFirmEmployment?(state?.firmWebsite??attorney.firm_website):attorney.employer_website;
 const personalLinkedIn=state?.profile?.linkedin_url??attorney.attorney_linkedin;
 const photo=attorneyPhoto(attorney.bar_number,state?.profile?.photo_key??attorney.photo_key);
 const published=attorney.published_details;
 const phone=attorney.owner_edited?attorney.phone:attorney.phone||published?.phone,email=attorney.owner_edited?attorney.email:attorney.email||published?.email;
 const officeAddress=[attorney.address?.trim(),attorney.city,attorney.state||'GA',attorney.zip].filter(Boolean).join(', ');
 const sourcedPractice=attorney.practice_areas||'';
 const practiceAreas=splitPracticeAreas(state?.profile?.practice_areas??attorney.practice_areas??sourcedPractice);
 const isJudge=practiceAreas.some(area=>practiceCategoryId(area)==='judge');
 const goodStanding=/^(?:active )?member in good standing$/.test(attorney.status?.trim().replace(/\s+/g,' ').toLowerCase()||'');
 const Heading=headingLevel;
 const date=(s:string)=>s?new Date(s).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}):'Not listed';
 return ( <div className="attorney-profile-container soft-profile"><div className="profile-skyline" aria-hidden="true"/><article ref={profileRef} className="profile-card directory-detail" aria-busy={loading}>
     <div className={`profile-heading${isJudge?' judge-profile-heading':''}`}><div className="profile-photo-column"><div className="profile-portrait-stack"><div className="portrait">{photo?<img src={photo} alt={`${attorney.name}, ${attorney.state||'GA'} attorney`} loading={headingLevel==='h1'?'eager':'lazy'} decoding="async"/>:<img className="profile-placeholder" src="/attorneys/placeholder.png" alt="No attorney photo supplied"/>}</div>{state?.profile?.claimed_at&&<OwnershipSeal labelled/>}</div>{!isJudge&&<a className="profile-photo-contact" href={'/hire-lawyer?attorney='+encodeURIComponent(attorney.bar_number)}><ActionIcon kind="email"/><span>Contact this attorney</span></a>}</div><div className="identity"><p className="section-kicker">{attorney.state||'GA'}</p><Heading>{attorney.name}</Heading><p className="role">{lawFirmEmployment?(currentFirm?<FirmLink name={currentFirm}/>:null):employmentLabel(attorney)}</p><YearsInPractice admitted={attorney.admit_date}/><div className="profile-location-row"><p className="location">{attorney.city || 'City not listed'}, {attorney.state||'GA'}</p>{personalLinkedIn&&<LinkedInLink href={personalLinkedIn} label="Attorney LinkedIn" iconOnly/>}</div><ProfileLanguages value={state?.profile?.languages}/><p className={`directory-status${goodStanding?' membership-good-standing':''}`}>{membershipStatus(attorney.status)}</p><SaveAttorneyButton attorney={attorney}/>{!isJudge&&<AttorneyReviewSummary key={attorney.bar_number} bar={attorney.bar_number} profile initialSummary={initialReviews?.summary}/ >}{isJudge&&<img className="judge-profile-emblem" src="/brand/judge-laurel-gold.webp" alt="" aria-hidden="true" width={180} height={120} decoding="async"/>}</div><nav className="profile-action-tiles" aria-label="Attorney contact options">
{phone&&<a href={'tel:'+phone.replace(/[^+\d]/g,'')}><ActionIcon kind="call"/><span>Call</span></a>}
{email&&<a href={'mailto:'+email}><ActionIcon kind="email"/><span>Email</span></a>}
{attorneyWebsite&&<a href={attorneyWebsite} target="_blank" rel="noopener noreferrer"><ActionIcon kind="website"/><span>{isJudge?'Official Court Website':'Attorney website'}<span className="sr-only"> (opens in a new tab)</span></span></a>}
{website&&<a href={website} target="_blank" rel="noopener noreferrer"><ActionIcon kind="firm"/><span>{isJudge?'Court website':lawFirmEmployment?'Law firm':'Employer website'}<span className="sr-only"> (opens in a new tab)</span></span></a>}
</nav></div><aside className="profile-practice" aria-labelledby={'practice-'+attorney.bar_number}><p className="section-kicker">PROFESSIONAL PROFILE</p><h3 id={'practice-'+attorney.bar_number}>Practice areas</h3>{practiceAreas.length?<ul>{practiceAreas.map(area=><li key={area}><a href={'/practice-areas/'+practiceCategoryId(area)}>{practiceCategoryId(area)==='judge'&&<img className="judge-role-icon" src={practiceIcon('judge')} alt="" width={24} height={24}/>} {area}</a></li>)}</ul>:<p className="record-note">Not listed.</p>}</aside>
     {loading?<p role="status">Loading attorney record…</p>:<div className="profile-body">
      <section className="credentials"><h3>Professional record</h3><dl><div><dt>Practice state</dt><dd>{attorney.state||'GA'}</dd></div><div><dt>Membership status</dt><dd className={goodStanding?'membership-good-standing':undefined}>{membershipStatus(attorney.status)}</dd></div><div><dt>Admitted</dt><dd>{attorney.admit_date?date(attorney.admit_date):published?published.admissionYear:'Not listed'}</dd></div><div><dt>{published?'Education':'Law school'}</dt><dd>{published&&!attorney.owner_edited?<ul className="profile-education-list">{published.education.map(item=><li key={item}>{item}</li>)}</ul>:attorney.law_school||'Not listed'}</dd></div><div><dt>County</dt><dd>{attorney.county||'Not listed'}</dd></div></dl>{attorney.source_url&&<a href={attorney.source_url} target="_blank" rel="noreferrer">View official bar record</a>}</section>
      {!isJudge&&<section className="profile-contact profile-office-location"><h3>Office location</h3>{attorney.address?.trim()?<><address>{attorney.address}<br/>{attorney.city}, {attorney.state||'GA'} {attorney.zip}</address><details className="office-directions" key={officeAddress} onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary>Get directions<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div className="office-map-options" aria-label="Choose a maps app"><a href={'https://maps.apple.com/?daddr='+encodeURIComponent(officeAddress)} target="_blank" rel="noopener noreferrer">Apple Maps<span className="sr-only"> (opens in a new tab)</span></a><a href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(officeAddress)} target="_blank" rel="noopener noreferrer">Google Maps<span className="sr-only"> (opens in a new tab)</span></a></div></details></>:<p>Office address is not published in the directory.</p>}</section>}{published&&<details className="published-professional-details"><summary>Education, Admissions &amp; Affiliations</summary><div className="published-professional-content"><p className="section-kicker">PROFESSIONAL DETAILS</p><p className="published-professional-role">{published.role}</p><section className="published-detail-group"><h3>Education</h3><ul>{published.education.map(item=><li key={item}>{item}</li>)}</ul></section><section className="published-detail-group"><h3>Admissions</h3><ul>{published.admissions.map(item=><li key={item}>{item}</li>)}</ul></section><section className="published-detail-group"><h3>Professional Affiliations</h3><ul>{published.affiliations.map(item=><li key={item}>{item}</li>)}</ul></section><p className="record-note">Source: Florida Law Advisers.</p><a className="website-link" href={published.source} target="_blank" rel="noopener noreferrer">View professional details<img className="website-link-icon" src="/internet-icon.png" alt="" aria-hidden="true"/></a></div></details>}{!isJudge&&<div className="profile-reviews-panel"><ClientReviews key={attorney.bar_number} bar={attorney.bar_number} initialData={initialReviews}/></div>}
     </div>}
    </article>
    {profileError&&<div className="directory-error" role="alert">{profileError} <button onClick={refresh}>Retry profile details</button></div>}
    {state?.profile&&(state.profile.headline||state.profile.bio)&&<section className="attorney-supplied"><p className="section-kicker">{state.profile.claimed_at?'PROVIDED BY THE ATTORNEY':'PROFESSIONAL PROFILE'}</p>{state.profile.headline&&<h2>{state.profile.headline}</h2>}{state.profile.bio&&<p className="profile-bio">{state.profile.bio}</p>}{!state.profile.bio&&!state.profile.headline&&!state.profile.practice_areas&&!state.profile.website&&<p>This attorney has claimed the profile and has not added professional details yet.</p>}<p className="record-note">Profile information is separate from the State Bar record above.</p></section>}
    {state&&<ClaimProfile bar={attorney.bar_number} name={attorney.name} state={state} onRefresh={refresh}/>}
    <div className="profile-permalink"><button type="button" className="outline-button" onClick={shareProfile} disabled={shareBusy}>{isJudge?'Share judge profile':'Share attorney profile'}</button><p role="status" aria-live="polite">{shareStatus}</p>{shareFallback&&<label>Profile link<input readOnly value={shareFallback} onFocus={event=>event.currentTarget.select()}/></label>}</div>
    </div>);
}
