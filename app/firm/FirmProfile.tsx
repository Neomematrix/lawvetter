'use client';
import type {hinesRoster} from '../verified-firm-rosters';
import {websitesByFirm,linkedInByFirm} from '../firm-websites';
import {firmKey} from '../api/attorneys/firm';
import { useEffect,useState } from 'react';
import type { Attorney } from '../GeorgiaDirectory';
import AttorneyProfile from '../AttorneyProfile';
import {SaveAttorneyButton,ShortlistNotice} from '../Shortlist';
import {requestAttorneyData} from '../attorney-request';
type FirmResults={firm:{name:string;verifiedRoster?:typeof hinesRoster;total:number;active:number;updated:string;cities:string[]};attorneys:Attorney[];page:number};
export default function FirmProfile({name}:{name:string}){
 const [page,setPage]=useState(1),[retry,setRetry]=useState(0),[result,setResult]=useState<FirmResults|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState<Attorney|null>(null),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState('');
 useEffect(()=>{
  if(!name.trim()){setError('Choose a firm by clicking its name on an attorney profile or search result.');setLoading(false);return;}
  const controller=new AbortController();setLoading(true);setError('');
  requestAttorneyData<FirmResults>({firm:name,page,...(page===1&&new URLSearchParams(window.location.search).get('search')?{eventId:new URLSearchParams(window.location.search).get('search')!}:{})},controller.signal).then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[name,page,retry]);
 async function open(a:Attorney){setSelected(a);setDetailLoading(true);setDetailError('');try{const x=await requestAttorneyData<{attorney:Attorney}>({id:a.bar_number});setSelected(x.attorney);}catch(e){setDetailError(e instanceof Error?e.message:'Unable to open this record.');}finally{setDetailLoading(false);}}
 const firm=result?.firm;
 const website=websitesByFirm[firmKey(firm?.name||name)];
 const linkedIn=linkedInByFirm[firmKey(firm?.name||name)];
 return <><section className="firm-hero"><div><a className="firm-back" href="/">Back to attorney search</a><p className="section-kicker">Firm profile</p><h1>{firm?.name||name||'Find a firm'}</h1>{firm&&<><p className="hero-intro">{firm.cities.join(' · ')||'Location not listed'}</p><div className="profile-firm-website"><h3>Official website</h3>{website?<a className="outline-button" href={website} target="_blank" rel="noopener noreferrer">Visit law firm website ↗</a>:<p className="record-note">Not yet listed.</p>}{linkedIn&&<a className="outline-button" href={linkedIn} target="_blank" rel="noopener noreferrer">Firm LinkedIn</a>}</div></>}</div></section><div className="page-shell"><ShortlistNotice/>
  {error&&<div className="directory-error" role="alert">{error} {name&&<button onClick={()=>setRetry(v=>v+1)}>Try again</button>}</div>}
  {selected?<><button className="outline-button" onClick={()=>setSelected(null)}>Back to firm attorneys</button>{detailError&&<p className="directory-error" role="alert">{detailError} <button onClick={()=>open(selected)}>Try again</button></p>}<AttorneyProfile attorney={selected} loading={detailLoading}/></>:<>
   <div className="section-heading"><h2>Attorneys at this firm</h2>{firm&&<span className="period-label">{(firm.total+(firm.verifiedRoster?.additional.length||0)).toLocaleString()} attorneys</span>}</div>
   <p className="trending-intro">Ordered by this month’s search ranking. Ties are listed alphabetically. All membership statuses are included. {firm?.verifiedRoster?'Firm membership checked against the official team page on '+firm.verifiedRoster.checked+'. Georgia attorneys appear first, ordered by search activity.':'These affiliations come from the State Bar directory and may not reflect the firm’s current team.'}</p>
   {loading?<p role="status">Loading firm attorneys…</p>:!error&&result&&<><div className="directory-grid">{result.attorneys.map(a=><article className="profile-card directory-result" key={a.bar_number}><p className="section-kicker">GA #{a.bar_number}</p><h3><button onClick={()=>open(a)}>{a.name}</button></h3><p>{a.company}</p><p className="location">{a.city||'City not listed'}, Georgia</p><p className="directory-status">{a.status}</p><button className="outline-button" onClick={()=>open(a)}>View profile</button><SaveAttorneyButton attorney={a}/></article>)}</div>{!!firm?.verifiedRoster?.additional.length&&page===1&&<section className="other-state-attorneys"><h3>Attorneys in other states</h3><div className="directory-grid">{firm.verifiedRoster.additional.map(a=><article className="profile-card directory-result" key={a.url}><p className="section-kicker">{a.jurisdiction}</p><h3>{a.name}</h3><p>{firm.name}</p><p>{a.practice}</p><p className="record-note">Listed by the firm as licensed in {a.jurisdiction}. Not included in Georgia search rankings.</p><a className="outline-button" href={a.url} target="_blank" rel="noopener noreferrer">View firm biography</a></article>)}</div><p className="record-note"><a href={firm.verifiedRoster.source} target="_blank" rel="noopener noreferrer">Official firm roster</a> · Checked {firm.verifiedRoster.checked}</p></section>}{result.attorneys.length===0&&<p>No attorneys on this page. Return to the previous page.</p>}<div className="directory-pagination"><button className="outline-button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.ceil(result.firm.total/25).toLocaleString()}</span><button className="outline-button" disabled={page*25>=result.firm.total} onClick={()=>setPage(p=>p+1)}>Next</button></div></>}
   {firm&&<p className="record-note">Records imported {new Date(firm.updated).toLocaleDateString('en-US',{timeZone:'UTC'})}. Formatting variations in firm names are grouped together.</p>}
  </>}
 </div></>;
}
