'use client';
import {displayBarNumber} from './attorney-identity';
import ClientReviews from './ClientReviews';
import {publishedAttorneyDetails} from './published-attorney-details';
import {firmWebsites,websitesByFirm,linkedInByFirm,attorneyLinkedIn} from './firm-websites';
import {firmKey} from './api/attorneys/firm';
import {verifiedFirmForAttorney} from './verified-firm-rosters';
import {attorneyPhoto} from './attorney-photo';
import {useEffect,useRef,useState} from 'react';
import ClaimProfile,{type ProfileState} from './ClaimProfile';
import {profileRequest} from './profile-request';
import type { Attorney } from './GeorgiaDirectory';
import { SaveAttorneyButton } from './Shortlist';
import { FirmLink } from './FirmLink';
import {attorneyPath} from './seo';
export default function AttorneyProfile({attorney,loading=false,headingLevel='h2'}:{attorney:Attorney;loading?:boolean;headingLevel?:'h1'|'h2'}){
 const profileRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(headingLevel!=='h2')return;const frame=requestAnimationFrame(()=>profileRef.current?.scrollIntoView({block:'start',behavior:'instant'}));return()=>cancelAnimationFrame(frame);},[attorney.bar_number,headingLevel]);
 const [state,setState]=useState<ProfileState|null>(null),[profileError,setProfileError]=useState('');
 async function refresh(){setProfileError('');try{setState(await profileRequest<ProfileState>({action:'view',bar:attorney.bar_number}));}catch(e){setProfileError(e instanceof Error?e.message:'Unable to load claimed profile details.');}}
 useEffect(()=>{setState(null);refresh();},[attorney.bar_number]);
 const currentFirm=verifiedFirmForAttorney(attorney.bar_number)?.name||attorney.company||'';
 const companyKey=firmKey(currentFirm);
 const website=state?.profile?.website||firmWebsites[attorney.bar_number]||websitesByFirm[companyKey];
 const personalLinkedIn=attorneyLinkedIn[attorney.bar_number],firmLinkedIn=linkedInByFirm[companyKey];
 const photo=attorneyPhoto(attorney.bar_number,state?.profile?.photo_key);
 const published=publishedAttorneyDetails(attorney);
 const phone=attorney.phone||published?.phone,email=attorney.email||published?.email;
 const Heading=headingLevel;
 const date=(s:string)=>s?new Date(s).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}):'Not listed';
 return ( <div className="attorney-profile-container"><article ref={profileRef} className="profile-card directory-detail" aria-busy={loading}>
     <div className="profile-heading"><div className="portrait">{photo?<img src={photo} alt={`${attorney.name}, ${attorney.state||'GA'} attorney`} loading={headingLevel==='h1'?'eager':'lazy'} decoding="async"/>:<img className="profile-placeholder" src="/attorneys/placeholder.png" alt="No attorney photo supplied"/>}</div><div className="identity"><p className="section-kicker">{attorney.state||'GA'} Bar #{displayBarNumber(attorney.bar_number)}</p><Heading>{attorney.name} {state?.profile?.claimed_at&&<img className="claimed-badge" src="/claimed-profile-checkmark.svg" alt="Claimed profile" title="Profile ownership reviewed by LawVetter"/>}</Heading>{state?.profile?.claimed_at&&<p className="claimed-label">Claimed profile · ownership reviewed</p>}{currentFirm&&<p className="role"><FirmLink name={currentFirm}/></p>}<p className="location">{attorney.city || 'City not listed'}, {attorney.state||'GA'}</p><p className="directory-status">{attorney.status}</p><SaveAttorneyButton attorney={attorney}/></div></div>
     {loading?<p role="status">Loading attorney record…</p>:<div className="profile-body">
      <section className="credentials"><h3>Professional record</h3><dl><div><dt>Bar number</dt><dd>{attorney.state||'GA'} #{displayBarNumber(attorney.bar_number)}</dd></div><div><dt>Membership status</dt><dd>{attorney.status}</dd></div><div><dt>Admitted</dt><dd>{attorney.admit_date?date(attorney.admit_date):published?published.admissionYear:'Not listed'}</dd></div><div><dt>{published?'Education':'Law school'}</dt><dd>{published?<ul className="profile-education-list">{published.education.map(item=><li key={item}>{item}</li>)}</ul>:attorney.law_school||'Not listed'}</dd></div><div><dt>County</dt><dd>{attorney.county||'Not listed'}</dd></div></dl><a href={attorney.source_url} target="_blank" rel="noreferrer">View official bar record</a></section>
      <section><h3>Public contact information</h3><p><a className="gold-button" href={'/hire-lawyer?attorney='+encodeURIComponent(attorney.bar_number)}>Contact this attorney</a></p><p className="record-note">Inquiries are saved for the LawVetter team to review and help you follow up.</p>{attorney.address&&<address>{attorney.address}<br/>{attorney.city}, {attorney.state||'GA'} {attorney.zip}</address>}{phone&&<p><a href={'tel:'+phone.replace(/[^+\d]/g,'')}>{phone}</a></p>}{email&&<p><a href={'mailto:'+email}>{email}</a></p>}{!attorney.address&&!phone&&!email&&<p>Contact information is not published in the directory.</p>}<div className="profile-firm-website"><h3>Law firm website</h3>{website?<a className="website-link" href={website} target="_blank" rel="noopener noreferrer">{website.replace(/^https?:\/\//,'').split(/[/?#]/)[0]}<img className="website-link-icon" src="/internet-icon.png" alt="" aria-hidden="true"/></a>:<p className="record-note">Not yet listed.</p>}</div><div className="profile-social-links">{personalLinkedIn&&<a href={personalLinkedIn} target="_blank" rel="noopener noreferrer">Attorney LinkedIn</a>}{firmLinkedIn&&<a href={firmLinkedIn} target="_blank" rel="noopener noreferrer">Firm LinkedIn</a>}</div></section>{published&&<details className="published-professional-details"><summary>Education, Admissions &amp; Affiliations</summary><div className="published-professional-content"><p className="section-kicker">PROFESSIONAL DETAILS</p><p className="published-professional-role">{published.role}</p><section className="published-detail-group"><h3>Education</h3><ul>{published.education.map(item=><li key={item}>{item}</li>)}</ul></section><section className="published-detail-group"><h3>Admissions</h3><ul>{published.admissions.map(item=><li key={item}>{item}</li>)}</ul></section><section className="published-detail-group"><h3>Professional Affiliations</h3><ul>{published.affiliations.map(item=><li key={item}>{item}</li>)}</ul></section><p className="record-note">Source: Florida Law Advisers.</p><a className="website-link" href={published.source} target="_blank" rel="noopener noreferrer">View professional details<img className="website-link-icon" src="/internet-icon.png" alt="" aria-hidden="true"/></a></div></details>}<div className="profile-reviews-panel"><ClientReviews key={attorney.bar_number} bar={attorney.bar_number}/></div>
     </div>}
    </article>
    {profileError&&<div className="directory-error" role="alert">{profileError} <button onClick={refresh}>Retry profile details</button></div>}
    {state?.profile?.claimed_at&&<section className="attorney-supplied"><p className="section-kicker">PROVIDED BY THE ATTORNEY</p>{state.profile.headline&&<h2>{state.profile.headline}</h2>}{state.profile.bio&&<p className="profile-bio">{state.profile.bio}</p>}{state.profile.practice_areas&&<><h3>Practice areas</h3><p>{state.profile.practice_areas}</p></>}{state.profile.website&&<a className="outline-button" href={state.profile.website} target="_blank" rel="noreferrer">Visit attorney website</a>}{!state.profile.bio&&!state.profile.headline&&!state.profile.practice_areas&&!state.profile.website&&<p>This attorney has claimed the profile and has not added professional details yet.</p>}<p className="record-note">Attorney-provided information is separate from the State Bar record above.</p></section>}
    {state&&<ClaimProfile bar={attorney.bar_number} name={attorney.name} state={state} onRefresh={refresh}/>}
    <p className="profile-permalink"><a href={attorneyPath(attorney)}>Open this attorney’s profile page</a></p>
    </div>);
}
