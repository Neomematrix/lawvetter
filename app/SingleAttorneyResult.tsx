'use client';
import {useEffect,useState} from 'react';
import type {Attorney} from './GeorgiaDirectory';
import {readJson} from './read-json';
import {profileRequest} from './profile-request';
import type {ProfileState} from './ClaimProfile';
import {attorneyPhoto} from './attorney-photo';
import {attorneyPath} from './seo';
import {employmentLabel} from './employment';
import {membershipStatus,GOOD_STANDING} from './membership-status';
import YearsInPractice from './YearsInPractice';
import ProfileLanguages from './ProfileLanguages';
import {FirmLink} from './FirmLink';
import {splitPracticeAreas,practiceCategoryId} from './practice-category';
import OwnershipSeal from './OwnershipSeal';
function ResultIcon({kind}:{kind:'call'|'email'|'website'|'firm'}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='call'?<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z"/>:kind==='email'?<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>:kind==='website'?<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>:<path d="m3 8 9-5 9 5H3ZM5 11v7m5-7v7m4-7v7m5-7v7M3 21h18"/>}</svg>;}
export default function SingleAttorneyResult({attorney}:{attorney:Attorney}){
 const [details,setDetails]=useState(attorney),[state,setState]=useState<ProfileState|null>(null);
 useEffect(()=>{const controller=new AbortController();
  // Enrich the preview without blocking native profile links. Unique searches
  // are already recorded by the search endpoint.
  void readJson<{attorney:Attorney}>('/api/attorneys?id='+encodeURIComponent(attorney.bar_number),controller.signal).then(data=>{if(!controller.signal.aborted&&data.attorney?.bar_number===attorney.bar_number)setDetails({...attorney,...data.attorney});}).catch(()=>{});
  void profileRequest<ProfileState>({action:'view',bar:attorney.bar_number}).then(data=>{if(!controller.signal.aborted)setState(data);}).catch(()=>{});
  return()=>controller.abort();
 },[attorney.bar_number]);
 const profile=state?.profile,photo=attorneyPhoto(details.bar_number,profile?.photo_key??details.photo_key),areas=splitPracticeAreas(profile?.practice_areas??details.practice_areas??''),judge=areas.some(area=>practiceCategoryId(area)==='judge'),isFirm=!details.employment_type||details.employment_type==='Law Firm Attorney',phone=details.phone||(!details.owner_edited?details.published_details?.phone:''),email=details.email||(!details.owner_edited?details.published_details?.email:''),website=profile?.website||details.biography_website,firmWebsite=isFirm?(state?.firmWebsite??details.firm_website):details.employer_website;
 return <div className="single-attorney-result attorney-profile-container soft-profile"><div className="profile-skyline" aria-hidden="true"/><article className="profile-card directory-detail" aria-label={'Matching attorney: '+details.name}><div className="profile-heading">
  <div className="profile-photo-column"><div className="profile-portrait-stack"><a className="portrait" href={attorneyPath(details)} aria-label={'View '+details.name+' profile'}><img src={photo||'/attorneys/placeholder.png'} alt={details.name} decoding="async"/></a>{(profile?.claimed_at||details.ownership_verified===1)&&<OwnershipSeal labelled/>}</div>{!judge&&<a className="profile-photo-contact" href={'/hire-lawyer?attorney='+encodeURIComponent(details.bar_number)}><ResultIcon kind="email"/><span>Contact this attorney</span></a>}<a className="single-result-view-profile" href={attorneyPath(details)} aria-label={'View '+details.name+' profile'}>View profile</a></div>
  <div className="identity"><p className="section-kicker">{details.state||'GA'}</p><h2><a href={attorneyPath(details)}>{details.name}</a></h2><p className="role">{isFirm?(details.company?<FirmLink name={details.company}/>:null):employmentLabel(details)}</p><YearsInPractice admitted={details.admit_date}/><div className="profile-location-row"><p className="location">{details.city||'City not listed'}, {details.state||'GA'}</p></div><ProfileLanguages value={profile?.languages??details.languages}/><p className={'directory-status'+(membershipStatus(details.status)===GOOD_STANDING?' membership-good-standing':'')}>{membershipStatus(details.status)}</p></div>
  <nav className="profile-action-tiles" aria-label="Attorney contact options">{!judge&&phone&&<a href={'tel:'+phone.replace(/[^+\d]/g,'')}><ResultIcon kind="call"/><span>Call</span></a>}{!judge&&email&&<a href={'mailto:'+email}><ResultIcon kind="email"/><span>Email</span></a>}{website&&<a href={website} target="_blank" rel="noopener noreferrer"><ResultIcon kind="website"/><span>{judge?'Court website':'Attorney website'}</span></a>}{firmWebsite&&<a href={firmWebsite} target="_blank" rel="noopener noreferrer"><ResultIcon kind="firm"/><span>{judge?'Court website':isFirm?'Law firm':'Employer website'}</span></a>}</nav>
 </div></article></div>;
}
