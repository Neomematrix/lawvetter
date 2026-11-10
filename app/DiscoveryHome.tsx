'use client';
import OwnershipSeal from './OwnershipSeal';

import {homePracticeIcon as practiceIcon} from './home-practice-icons';
import {attorneyDisplayName} from './attorney-name';
import AttorneyReviewSummary from './AttorneyReviewSummary';
import {attorneyPhoto} from './attorney-photo';
import {PopularAttorneys} from './DiscoveryCarousels';
import {practiceAreas} from './practice-catalog';
import type {MouseEvent} from 'react';
import type {Attorney} from './GeorgiaDirectory';
import {FirmLink} from './FirmLink';
import {SaveAttorneyButton,useShortlist} from './Shortlist';
import {attorneyPath} from './seo';
import type {RankedAttorney,DiscoveryData,View} from './Discovery';
import {homePortrait} from './home-image';
function SectionTitle({eyebrow,title,action,onAction}:{eyebrow?:string;title:string;action?:string;onAction?:()=>void}){return <div className="section-heading"><div>{eyebrow&&<p className="section-kicker">{eyebrow}</p>}<h2>{title}</h2></div>{action&&<button className="text-action" onClick={onAction}>{action} <span aria-hidden="true">›</span></button>}</div>;}
function EmptyChart({firm=false}:{firm?:boolean}){return <div className="chart-empty"><span className="empty-chart-icon" aria-hidden="true">↗</span><div><h3>{firm?'Firm rankings are taking shape.':'Every discovery starts with a search.'}</h3><p>{firm?'Firms will rank here as visitors search for them and their attorneys.':'Real search activity will build this chart. Search for an attorney above to get started.'}</p></div></div>;}
export function RankedPreviewCard({attorney,period,onOpen}:{attorney:RankedAttorney;period:string;onOpen:(attorney:Attorney)=>void}){
 const href=attorneyPath(attorney),open=(event:MouseEvent<HTMLAnchorElement>)=>{event.preventDefault();onOpen(attorney);};
 return <article className="shortlist-attorney-card">
  <div className="shortlist-attorney-main">
   <a className="shortlist-attorney-photo" href={href} onClick={open} aria-label={'View '+attorney.name}>{attorneyPhoto(attorney.bar_number,attorney.photo_key)?<img width={440} height={400} {...homePortrait(attorney,'preview')} alt={`${attorney.name}, ${attorney.state||'GA'} attorney`} loading="lazy" decoding="async"/>:<img className="attorney-placeholder" width={512} height={512} loading="lazy" decoding="async" src="/attorneys/placeholder.73de70770474.webp" alt="No photo supplied"/>}</a>
   <span className="shortlist-attorney-rank">#{attorney.rank} {period}</span>
   <div className="shortlist-attorney-name"><strong><a href={href} onClick={open} title={attorney.name}>{attorneyDisplayName(attorney.name)}</a></strong>{attorney.ownership_verified===1&&<OwnershipSeal/>}</div>
   <small>{attorney.company||`${attorney.city||'Location not listed'}, ${attorney.state||'GA'}`}</small>
   <a className="shortlist-attorney-link" href={href} onClick={open}>View record</a>
  </div>
  <AttorneyReviewSummary bar={attorney.bar_number} card/>
  <SaveAttorneyButton attorney={attorney}/>
 </article>;
}
export function DiscoveryHome({data,onOpen,onView,onPractice}:{data:DiscoveryData;onPractice:(id:string)=>void;onOpen:(a:Attorney)=>void;onView:(v:View)=>void}){
 const s=useShortlist();
 const rankedPreview=[...data.weekly.map(attorney=>({attorney,period:'this week'})),...data.monthly.filter(attorney=>!data.weekly.some(weekly=>weekly.bar_number===attorney.bar_number)).map(attorney=>({attorney,period:'this month'}))].slice(0,3);
 return <div className="discovery-content">
 {data.unavailable?<div className="directory-error" role="status">{data.loading?'Loading current rankings…':'Live rankings are temporarily unavailable. Explore practice areas below or try the attorney search above.'}</div>:<>
 <section className="discovery-section popular-attorneys-section"><SectionTitle eyebrow="The weekly chart" title="Most searched attorneys" action="Explore the chart" onAction={()=>onView('charts')}/>{(data.popular||data.weekly).length?<PopularAttorneys attorneys={data.popular||data.weekly} featuredAttorneyId={data.monthly[0]?.bar_number} onOpen={onOpen}/>:<EmptyChart/>}</section>
 </>}
 <section className="discovery-section" id="practice-areas"><SectionTitle eyebrow="Find the right kind of help" title="Explore by practice area"/><div className="practice-grid">{(data.practiceCategories||practiceAreas).map(area=><a className="practice-tile" href={'/practice-areas/'+area.id} key={area.id}><strong>{area.name}</strong><span>{area.description}</span><b aria-hidden="true">{practiceIcon(area.id)?<img className="practice-tile-icon" src={practiceIcon(area.id)} alt="" width={42} height={42} loading="lazy" decoding="async"/>:'↗'}</b></a>)}</div></section>
 {!data.unavailable&&<section className="discovery-section firm-feature"><SectionTitle eyebrow="The firms behind the names" title="Most searched firms" action="All rankings" onAction={()=>onView('charts')}/><p className="section-description">Search interest in firms and their attorneys over the last 7 days.</p>{data.weeklyFirms.length?<div className="firm-ranking-grid">{data.weeklyFirms.slice(0,6).map(f=><article className="firm-rank-card" key={f.firm_key}><span className="firm-position">{f.rank}</span><div><h3><FirmLink name={f.name}/></h3></div><span className="firm-card-arrow" aria-hidden="true">›</span></article>)}</div>:<EmptyChart firm/>}</section>}
 <section className="shortlist-banner"><div><p className="section-kicker">YOUR LIST. YOUR RESEARCH.</p><h2>Keep the names.<br/>Compare the details.</h2><p>Save attorneys to a private client profile, then compare up to three professional records side by side.</p>{s.signedIn?<button className="gold-button" onClick={()=>onView('shortlist')}>Open your shortlist {s.attorneys.length>0&&`(${s.attorneys.length})`}</button>:!s.loading&&<a className="gold-button" href="/client-reviews?mode=register">Create a profile to save attorneys</a>}</div>{rankedPreview.length>0&&<div className="shortlist-attorneys" aria-label="Currently ranked attorneys">{rankedPreview.map(({attorney,period})=><RankedPreviewCard attorney={attorney} period={period} onOpen={onOpen} key={attorney.bar_number}/>)}</div>}</section>
 <section className="discovery-section client-research-section" aria-labelledby="client-research-title">
  <div className="client-research-heading"><p className="section-kicker">LEGAL HELP, WITH CLARITY</p><h2 id="client-research-title">Your next step starts here.</h2><p>Find. Compare. Explore. All in one place.</p></div>
  <div className="research-grid client-research-grid">
   <article><div className="research-card-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>FIND</span></div><h3>Search your area.</h3><p>Find attorneys and law firms for your location and legal needs.</p><a href="/discover">Find an attorney</a></article>
   <article><div className="research-card-top"><svg className="research-owl-eyes" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m2 3 7 3 7 3 7-3 7-3-2 6M2 3l2 6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="12" r="6.5"/><circle cx="23" cy="12" r="6.5"/><circle cx="10" cy="12" r="2.3" fill="currentColor" stroke="none"/><circle cx="22" cy="12" r="2.3" fill="currentColor" stroke="none"/><path d="m14 19 2 3 2-3" strokeLinecap="round" strokeLinejoin="round"/></svg><span>COMPARE</span></div><h3>Look a little closer.</h3><p>Read professional records and verified client reviews.</p><a href="/?view=shortlist" onClick={event=>{event.preventDefault();onView('shortlist');}}>View shortlist</a></article>
   <article><div className="research-card-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 19V5M4 19h16M7 14l5-5 4 3 5-7M16 5h5v5" strokeLinecap="round" strokeLinejoin="round"/></svg><span>TRENDING</span></div><h3>See who’s trending</h3><p>Explore the most searched attorneys and firms, then visit their profiles.</p><a href="/?view=charts" onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onView('charts');}}}>View rankings</a></article>
  </div>
 </section>
 </div>;
}
