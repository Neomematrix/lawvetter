'use client';
import type {MouseEvent} from 'react';
import type {Attorney} from './GeorgiaDirectory';
import type {DiscoveryData} from './Discovery';
import {attorneyDisplayName} from './attorney-name';
import {attorneyPhoto} from './attorney-photo';
import {homePortrait} from './home-image';
import {attorneyPath} from './seo';
import {stateNames,usStates} from './us-states';
import {FirmLink} from './FirmLink';
import AttorneyReviewSummary from './AttorneyReviewSummary';

export default function MonthlySpotlight({data,onOpen,onMonthlyChart,variant='chart'}:{data:DiscoveryData;onOpen:(attorney:Attorney)=>void;onMonthlyChart?:()=>void;variant?:'chart'|'hero'}){
 const top=data.monthly[0];
 if(data.unavailable||!top)return null;
 const hero=variant==='hero',headingId=hero?'hero-leading-lawyer-title':'monthly-leading-lawyer-title';
 const state=top.state||'GA',stateName=stateNames[usStates.findIndex(code=>code===state)]||state;
 const ordinaryClick=(event:MouseEvent<HTMLAnchorElement>)=>event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey;
 const open=(event:MouseEvent<HTMLAnchorElement>)=>{if(ordinaryClick(event)){event.preventDefault();onOpen(top);}};
 return <div className={'spotlight-layout'+(hero?' hero-monthly-spotlight':'')}><section className={'monthly-spotlight spotlight-featured'+(attorneyPhoto(top.bar_number,top.photo_key)?' has-portrait':'')} aria-labelledby={headingId}>
  <div className="spotlight-art" aria-hidden="true"><div className="spotlight-ring"/>{attorneyPhoto(top.bar_number,top.photo_key)?<img className="spotlight-photo" width={440} height={400} {...homePortrait(top,'spotlight')} alt={`${top.name}, ${stateName} attorney`} loading={hero?'eager':'lazy'} fetchPriority={hero?'high':undefined} decoding="async"/>:<img className="spotlight-placeholder" width={512} height={512} loading="lazy" decoding="async" src="/attorneys/placeholder.73de70770474.webp" alt=""/>}<div className="column-lines"><i/><i/><i/><i/><i/></div></div>
  <div className="spotlight-copy">
   <div className="spotlight-intro"><p className="section-kicker">LAWVETTER SPOTLIGHT · {data.monthLabel}</p><h2 id={headingId}>This month’s leading lawyer</h2><p className="spotlight-name"><a href={attorneyPath(top)} onClick={open} title={top.name}>{attorneyDisplayName(top.name)}</a></p>{top.ownership_verified===1&&<span className="verified-ownership-compact spotlight-verified-owl" title="Identity verified by LawVetter"><img src="/brand/lawvetter-icon.svg" alt="Verified by LawVetter" width="36" height="28"/></span>}<p className="spotlight-firm">{top.company&&<FirmLink name={top.company}/>}</p><p className="spotlight-location">{top.city}, {stateName}</p></div>
   <a className="spotlight-score" href="/?view=charts&period=monthly" aria-label="View this month’s most searched attorneys" onClick={event=>{if(onMonthlyChart&&ordinaryClick(event)){event.preventDefault();onMonthlyChart();}}}><strong>#{top.rank}</strong><span>Most searched this month</span></a>
   {!hero&&<AttorneyReviewSummary bar={top.bar_number} featured/>}
   <a className="gold-button" href={attorneyPath(top)} onClick={open}>Explore attorney</a>
   <p className="spotlight-footnote">{hero?'Based on search activity. Popularity does not measure legal ability.':<>Based on LawVetter searches and Google search arrivals. Popularity is not a measure of legal ability. <a href="/awards">Monthly awards &amp; downloads</a></>}</p>
  </div>
 </section></div>;
}
