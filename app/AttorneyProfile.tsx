'use client';
import {attorneyPhoto} from './attorney-photo';
import {useEffect,useState} from 'react';
import ClaimProfile,{type ProfileState} from './ClaimProfile';
import {profileRequest} from './profile-request';
import type { Attorney } from './GeorgiaDirectory';
import { SaveAttorneyButton } from './Shortlist';
import { FirmLink } from './FirmLink';
export default function AttorneyProfile({attorney,loading=false}:{attorney:Attorney;loading?:boolean}){
 const [state,setState]=useState<ProfileState|null>(null),[profileError,setProfileError]=useState('');
 async function refresh(){setProfileError('');try{setState(await profileRequest<ProfileState>({action:'view',bar:attorney.bar_number}));}catch(e){setProfileError(e instanceof Error?e.message:'Unable to load claimed profile details.');}}
 useEffect(()=>{setState(null);refresh();},[attorney.bar_number]);
 const photo=attorneyPhoto(attorney.bar_number,state?.profile?.photo_key);
 const date=(s:string)=>s?new Date(s).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}):'Not listed';
 return ( <><article className="profile-card directory-detail" aria-busy={loading}>
     <div className="profile-heading"><div className="portrait">{photo?<img src={photo} alt={attorney.name}/>:<span>{attorney.name.split(' ').filter(Boolean).map(n=>n[0]).slice(0,2).join('')}</span>}</div><div className="identity"><p className="section-kicker">Georgia Bar #{attorney.bar_number}</p><h2>{attorney.name} {state?.profile&&<img className="claimed-badge" src="/claimed-badge.png" alt="Claimed profile" title="Profile ownership reviewed by CounselCheck"/>}</h2>{state?.profile&&<p className="claimed-label">Claimed profile · ownership reviewed</p>}{attorney.company&&<p className="role"><FirmLink name={attorney.company}/></p>}<p className="location">{attorney.city || 'City not listed'}, Georgia</p><p className="directory-status">{attorney.status}</p><SaveAttorneyButton attorney={attorney}/></div></div>
     {loading?<p role="status">Loading attorney record…</p>:<div className="profile-body">
      <section className="credentials"><h3>Professional record</h3><dl><div><dt>Bar number</dt><dd>GA #{attorney.bar_number}</dd></div><div><dt>Membership status</dt><dd>{attorney.status}</dd></div><div><dt>Admitted</dt><dd>{date(attorney.admit_date)}</dd></div><div><dt>Law school</dt><dd>{attorney.law_school||'Not listed'}</dd></div><div><dt>County</dt><dd>{attorney.county||'Not listed'}</dd></div></dl><p className="record-note">Imported from the State Bar directory on {date(attorney.imported_at)}. Status may change after this date.</p><a href={attorney.source_url} target="_blank" rel="noreferrer">View official bar record</a></section>
      <section><h3>Public contact information</h3>{attorney.address&&<address>{attorney.address}<br/>{attorney.city}, GA {attorney.zip}</address>}{attorney.phone&&<p><a href={'tel:'+attorney.phone.replace(/[^+\d]/g,'')}>{attorney.phone}</a></p>}{attorney.email&&<p><a href={'mailto:'+attorney.email}>{attorney.email}</a></p>}{!attorney.address&&!attorney.phone&&!attorney.email&&<p>Contact information is not published in the directory.</p>}<h3 className="directory-review-heading">Client reviews</h3><p>No client reviews have been collected for this attorney.</p></section>
     </div>}
    </article>
    {profileError&&<div className="directory-error" role="alert">{profileError} <button onClick={refresh}>Retry profile details</button></div>}
    {state?.profile&&<section className="attorney-supplied"><p className="section-kicker">PROVIDED BY THE ATTORNEY</p>{state.profile.headline&&<h2>{state.profile.headline}</h2>}{state.profile.bio&&<p className="profile-bio">{state.profile.bio}</p>}{state.profile.practice_areas&&<><h3>Practice areas</h3><p>{state.profile.practice_areas}</p></>}{state.profile.website&&<a className="outline-button" href={state.profile.website} target="_blank" rel="noreferrer">Visit attorney website</a>}{!state.profile.bio&&!state.profile.headline&&!state.profile.practice_areas&&!state.profile.website&&<p>This attorney has claimed the profile and has not added professional details yet.</p>}<p className="record-note">Attorney-provided information is separate from the State Bar record above.</p></section>}
    {state&&<ClaimProfile bar={attorney.bar_number} name={attorney.name} state={state} onRefresh={refresh}/>}
    <p className="profile-permalink"><a href={'/attorney?bar='+attorney.bar_number}>Open this attorney’s profile page</a></p>
    </>);
}
