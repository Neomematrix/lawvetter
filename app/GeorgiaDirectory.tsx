"use client";
import { FormEvent, useEffect, useState } from 'react';
import { requestAttorneyData } from './attorney-request';
type Attorney = {bar_number:string;name:string;company:string;city:string;county:string;status:string;admit_date:string;imported_at:string;law_school?:string;address?:string;zip?:string;phone?:string;email?:string;source_url?:string};
type Results = {attorneys:Attorney[];total:number;page:number;totalImported:number;updated:string;statuses:string[]};
export default function GeorgiaDirectory() {
 const [name,setName]=useState(''),[city,setCity]=useState(''),[status,setStatus]=useState('');
 const [query,setQuery]=useState({q:'',city:'',status:'',page:1,eventId:''});
 const [searched,setSearched]=useState(false),[home,setHome]=useState<{trending:(Attorney&{searches:number})[];statuses:string[]}|null>(null);
 const [result,setResult]=useState<Results|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState<Attorney|null>(null),[detailLoading,setDetailLoading]=useState(false);
 const [homeLoading,setHomeLoading]=useState(true);
 async function loadHome(){setHomeLoading(true);setError('');try{setHome(await requestAttorneyData<{trending:(Attorney&{searches:number})[];statuses:string[]}>({home:'1'}));}catch(e){setError(e instanceof Error?e.message:'Unable to load trending attorneys.');}finally{setHomeLoading(false);}}
 useEffect(()=>{loadHome();},[]);
 useEffect(()=>{
  if(!searched)return;
  const controller=new AbortController();
  requestAttorneyData<Results>(query,controller.signal).then(x=>{setResult(x);}).catch(e=>{if(e.name!=='AbortError')setError(e.message || 'Unable to load attorneys.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[query,searched]);
 function changeQuery(next: typeof query) {setLoading(true);setError('');setQuery(next);}
 function search(e:FormEvent){e.preventDefault();if(!name.trim()&&!city.trim()&&!status){setError('Enter a name, firm, bar number, city, or membership status to search.');return;}setSelected(null);setSearched(true);changeQuery({q:name.trim(),city:city.trim(),status,page:1,eventId:crypto.randomUUID()});}
 async function open(a:Attorney,fromSearch=false){setSelected(a);setDetailLoading(true);setError('');try{const x=await requestAttorneyData<{attorney:Attorney}>({id:a.bar_number,...(fromSearch?query:{})});setSelected(x.attorney);}catch(e){setError(e instanceof Error?e.message:'Unable to open this record.');}finally{setDetailLoading(false);}}
 const date=(s:string)=>s?new Date(s).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}):'Not listed';
 return <>
  <section className="search-band directory-search" aria-label="Georgia attorney search"><div>
   <p className="eyebrow light">Discover Georgia attorneys</p><h1>Know who<br/><span>represents you.</span></h1><p className="hero-intro">Search professional records. Explore the attorneys people are looking for.</p>
   <form className="directory-filters" onSubmit={search}>
    <label>Name, firm, or bar number<input value={name} onChange={e=>setName(e.target.value)} placeholder="Search Georgia attorneys" /></label>
    <label>City<input value={city} onChange={e=>setCity(e.target.value)} placeholder="Any Georgia city" /></label>
    <label>Membership status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{home?.statuses.map(s=><option key={s}>{s}</option>)}</select></label>
    <button type="submit">Search</button>
   </form>
   <p className="search-note">Search by official name, verified nickname, firm, or Georgia Bar number.</p>
  </div></section>
  <div className="page-shell directory-page">
   {error&&<div role="alert" className="directory-error">{error} <button onClick={()=>selected ? open(selected) : searched ? changeQuery({...query}) : loadHome()}>Try again</button> <a href="/" target="_top">Reopen CounselCheck</a></div>}
   {selected?<>
    <button className="outline-button" onClick={()=>setSelected(null)}>{searched?'Back to results':'Back to trending'}</button>
    <article className="profile-card directory-detail" aria-busy={detailLoading}>
     <div className="profile-heading"><div className="portrait"><span>{selected.name.split(' ').filter(Boolean).map(n=>n[0]).slice(0,2).join('')}</span></div><div className="identity"><p className="section-kicker">Georgia Bar #{selected.bar_number}</p><h2>{selected.name}</h2>{selected.company&&<p className="role">{selected.company}</p>}<p className="location">{selected.city || 'City not listed'}, Georgia</p><p className="directory-status">{selected.status}</p></div></div>
     {detailLoading?<p role="status">Loading attorney record…</p>:<div className="profile-body">
      <section className="credentials"><h3>Professional record</h3><dl><div><dt>Bar number</dt><dd>GA #{selected.bar_number}</dd></div><div><dt>Membership status</dt><dd>{selected.status}</dd></div><div><dt>Admitted</dt><dd>{date(selected.admit_date)}</dd></div><div><dt>Law school</dt><dd>{selected.law_school||'Not listed'}</dd></div><div><dt>County</dt><dd>{selected.county||'Not listed'}</dd></div></dl><p className="record-note">Imported from the State Bar directory on {date(selected.imported_at)}. Status may change after this date.</p><a href={selected.source_url} target="_blank" rel="noreferrer">View official bar record</a></section>
      <section><h3>Public contact information</h3>{selected.address&&<address>{selected.address}<br/>{selected.city}, GA {selected.zip}</address>}{selected.phone&&<p><a href={'tel:'+selected.phone.replace(/[^+\d]/g,'')}>{selected.phone}</a></p>}{selected.email&&<p><a href={'mailto:'+selected.email}>{selected.email}</a></p>}{!selected.address&&!selected.phone&&!selected.email&&<p>Contact information is not published in the directory.</p>}<h3 className="directory-review-heading">Client reviews</h3><p>No client reviews have been collected for this attorney.</p></section>
     </div>}
    </article>
   </>:!searched?<section className="trending-section" aria-label="Trending attorneys">
    <div className="section-heading"><div><p className="section-kicker">Most searched this week</p><h2>Trending attorneys</h2></div><span className="period-label">Last 7 days</span></div>
    <p className="trending-intro">The attorneys people are finding on CounselCheck. Search interest is not a rating or endorsement.</p>
    {homeLoading?<p role="status">Loading trending attorneys…</p>:home?.trending.length?<div className="trending-grid">{home.trending.map((a,i)=><article className="trending-card" key={a.bar_number}><button className="trending-open" onClick={()=>open(a)}><div className="attorney-tile"><span className="rank">{i+1}</span><span className="initials">{a.name.split(' ').filter(Boolean).map(n=>n[0]).slice(0,2).join('')}</span><span className="tile-caption">GEORGIA ATTORNEY</span></div><div className="trending-info"><span className="search-count">{a.searches} {a.searches===1?'search':'searches'}</span><h3>{a.name}</h3><p>{a.company}</p><p>{a.city||'City not listed'}, Georgia</p><span className="profile-link">View profile</span></div></button></article>)}</div>:<div className="trending-empty"><span className="empty-symbol" aria-hidden="true">↗</span><h3>Discover who’s trending next.</h3><p>Trending attorneys will appear as people search and select profiles. Start with a name above.</p></div>}
    <p className="trending-method">One count per search that finds a single attorney or leads to a selected profile. Broad result lists and visits from this section do not add counts.</p>
   </section>:<>
    <div className="section-heading directory-results-heading"><div><p className="section-kicker">Search results</p><h2>{loading?'Loading results…':`${(result?.total||0).toLocaleString()} ${result?.total===1?'attorney':'attorneys'}`}</h2></div>{result&&<p className="result-source">State Bar of Georgia records<br/><small>Updated {date(result.updated)}</small></p>}</div>
    {loading?<p role="status">Loading Georgia attorneys…</p>:result?.attorneys.length?<>
     <div className="directory-grid">{result.attorneys.map(a=><article className="profile-card directory-result" key={a.bar_number}><p className="section-kicker">GA #{a.bar_number}</p><h3><button onClick={()=>open(a,true)}>{a.name}</button></h3>{a.company&&<p>{a.company}</p>}<p className="location">{a.city||'City not listed'}, Georgia</p><p className="directory-status">{a.status}</p><button className="outline-button" onClick={()=>open(a,true)}>View profile</button></article>)}</div>
     <div className="directory-pagination"><button className="outline-button" disabled={query.page<=1} onClick={()=>changeQuery({...query,page:query.page-1})}>Previous</button><span>Page {query.page} of {Math.ceil(result.total/25).toLocaleString()}</span><button className="outline-button" disabled={query.page*25>=result.total} onClick={()=>changeQuery({...query,page:query.page+1})}>Next</button></div>
    </>:<p>{result?.totalImported?'No attorneys match your search. Try another name, city, or status.':'Georgia records have not been imported yet.'}</p>}
   </>}
  </div>
 </>;
}
