'use client';
import {employmentLabel} from './employment';
import type {MouseEvent,ReactNode} from 'react';
import type {Attorney} from './GeorgiaDirectory';
import OwnershipSeal from './OwnershipSeal';
import YearsInPractice from './YearsInPractice';
import ProfileLanguages from './ProfileLanguages';
import {membershipStatus,GOOD_STANDING} from './membership-status';
import {attorneyDisplayName} from './attorney-name';
import AttorneyReviewSummary from './AttorneyReviewSummary';
import {attorneyPhoto} from './attorney-photo';
import {FirmLink} from './FirmLink';
import {SaveAttorneyButton} from './Shortlist';
import {attorneyPath} from './seo';
export function AttorneyCard({attorney,onOpen,rank,priority=false,photo,actions,showFullName=false,showLanguages=false,carouselSlot,inactive=false}:{attorney:Attorney&{searches?:number};onOpen:(a:Attorney)=>void;rank?:number;priority?:boolean;photo?:{src?:string;srcSet?:string;sizes?:string};actions?:ReactNode;showFullName?:boolean;showLanguages?:boolean;carouselSlot?:number;inactive?:boolean}){
 const currentFirm=attorney.company||'';
 const href=attorneyPath(attorney),open=(event:MouseEvent<HTMLAnchorElement>)=>{event.preventDefault();onOpen(attorney);};
 return <article aria-hidden={inactive||undefined} inert={inactive||undefined} style={carouselSlot===undefined?undefined:{gridColumn:carouselSlot+1}} className={'lawyer-card'+(inactive?' carousel-inactive':'')+(attorney.ownership_verified===1?' ownership-verified':'')}><div className="lawyer-poster"><a className="lawyer-photo-link" href={href} onClick={open} aria-label={'View '+attorney.name}>{!inactive&&(attorneyPhoto(attorney.bar_number,attorney.photo_key)?<img className="attorney-photo" width={440} height={400} src={photo?.src||attorneyPhoto(attorney.bar_number,attorney.photo_key)} srcSet={photo?.srcSet} sizes={photo?.sizes} alt={`${attorney.name}, ${attorney.state||'GA'} attorney`} loading={priority?"eager":"lazy"} fetchPriority={priority?"high":"auto"} decoding="async"/>:<img className="attorney-placeholder" width={512} height={512} loading="lazy" decoding="async" src="/attorneys/placeholder.73de70770474.webp" alt="No photo supplied"/>)}<span className="poster-label"><span>{attorney.state||'GA'}</span></span>{rank&&<span className="poster-rank">{rank}</span>}</a></div><div className="lawyer-card-body"><div className="card-name-row"><h3><a className="attorney-name-link" href={href} onClick={open} title={attorney.name}>{showFullName?attorney.name:attorneyDisplayName(attorney.name)}</a></h3>{attorney.ownership_verified===1&&<OwnershipSeal/>}</div><p className="card-firm">{(!attorney.employment_type||attorney.employment_type==='Law Firm Attorney')?(currentFirm?<FirmLink name={currentFirm}/>:null):employmentLabel(attorney)}</p><div className="card-experience"><YearsInPractice admitted={attorney.admit_date}/></div><p className="card-city">{attorney.city||'City not listed'}, {attorney.state||'GA'}</p>{showLanguages&&<ProfileLanguages value={attorney.languages}/>}<p className={`directory-status card-status${membershipStatus(attorney.status)===GOOD_STANDING?' membership-good-standing':''}`}>{membershipStatus(attorney.status)}</p><div className="lawyer-card-actions">{actions??<>{!inactive&&<><SaveAttorneyButton attorney={attorney}/><AttorneyReviewSummary bar={attorney.bar_number} card/></>}<a className="card-details" href={href} onClick={open}>View professional record</a></>}</div></div></article>;
}
