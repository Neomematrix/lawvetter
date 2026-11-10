'use client';
import ProfessionalWorkspaceSwitch from '../ProfessionalWorkspaceSwitch';
import WebsiteBadgePanel from '../WebsiteBadgePanel';
import type {ReactNode} from 'react';
import {useShortlist,SaveAttorneyButton} from '../Shortlist';
import FirmAttorneyPhoto from '../firm/FirmAttorneyPhoto';
import {attorneyPath} from '../seo';

export type ClientSection='attorneys'|'reviews'|'shortlist'|'settings'|'firm-analytics'|'firm-inbox';
const sections=[{id:'attorneys',label:'My attorneys'},{id:'reviews',label:'My reviews'},{id:'shortlist',label:'Shortlist'}] as const;

function SavedAttorneys(){
 const saved=useShortlist();
 if(saved.loading)return <p role="status">Loading your shortlist…</p>;
 if(saved.error)return <p className="directory-error" role="alert">{saved.error} <button type="button" onClick={saved.reload}>Try again</button></p>;
 if(!saved.attorneys.length)return <div className="client-workspace-empty"><h2>Your shortlist is empty</h2><p>Save attorneys as you explore to find them here.</p><a className="outline-button" href="/discover">Find an attorney</a></div>;
 return <><div className="client-workspace-saved">{saved.attorneys.map(a=><article className="client-workspace-saved-row" key={a.bar_number}><FirmAttorneyPhoto bar={a.bar_number} name={a.name}/><div><h2><a href={attorneyPath(a)}>{a.name}</a></h2><p>{[a.city,a.state].filter(Boolean).join(', ')}</p></div><SaveAttorneyButton attorney={a}/></article>)}</div><a className="client-workspace-compare" href="/?view=shortlist">Open shortlist to compare attorneys</a></>;
}

export default function ClientWorkspace({section,onSectionChange,hasAttorneyProfiles,name,accountSettings,children,firmName}:{section:ClientSection;onSectionChange:(section:ClientSection)=>void;hasAttorneyProfiles:boolean;name:string;accountSettings:ReactNode;children:ReactNode;firmName?:string}){
 const title=section==='attorneys'?(firmName?'Firm attorneys':'My attorneys'):section==='firm-analytics'?'Analytics':section==='firm-inbox'?'Inbox':section==='reviews'?'My reviews':section==='shortlist'?'Shortlist':'Account settings';
 return <div className="page-shell account-page client-review-account client-slim-workspace">
  {firmName&&hasAttorneyProfiles&&<ProfessionalWorkspaceSwitch active="firm"/>}<aside className="client-workspace-sidebar"><p className="client-workspace-label">YOUR SPACE</p><nav aria-label="Your account">{(firmName?[{id:'attorneys',label:'Firm attorneys'},{id:'firm-analytics',label:'Analytics'},{id:'firm-inbox',label:'Inbox'}] as const:sections).map(item=><button key={item.id} type="button" aria-current={section===item.id?'page':undefined} aria-controls="client-workspace-content" onClick={()=>onSectionChange(item.id)}>{item.id==='attorneys'&&firmName?'Firm attorneys':item.label}</button>)}</nav><div className="client-workspace-sidebar-bottom">{firmName&&<a href={'/firm-access?firm='+encodeURIComponent(firmName)}>Firm access</a>}{hasAttorneyProfiles&&!firmName&&<a href="/account">My lawyer account</a>}<button type="button" aria-current={section==='settings'?'page':undefined} aria-controls="client-workspace-content" onClick={()=>onSectionChange('settings')}>Account settings</button></div>{firmName&&<WebsiteBadgePanel key={firmName} firm={firmName} name={firmName} path={'/firm?name='+encodeURIComponent(firmName)}/>}</aside>
  <section id="client-workspace-content" className="client-workspace-main" aria-labelledby="client-workspace-title">
   <header className="client-workspace-heading"><div><p className="client-workspace-welcome">{name?'Welcome back, '+name:'Your private workspace'}</p><h1 id="client-workspace-title">{title}</h1></div>{section!=='settings'&&<a className="gold-button" href={firmName?'/firm?name='+encodeURIComponent(firmName):'/discover'}>{firmName?'View firm page':'Find an attorney'}</a>}</header>
   {section==='shortlist'?<SavedAttorneys/>:section==='settings'?<div className="client-workspace-settings">{accountSettings}{!firmName&&<details className="dashboard-review-help"><summary>How verified reviews work</summary><p>We confirm that the attorney represented you before you can publish a review. Your court information and verification documents stay private.</p></details>}</div>:children}
  </section>
 </div>;
}
