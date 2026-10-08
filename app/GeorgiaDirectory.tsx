"use client";
import { FormEvent, useEffect, useState } from 'react';
import { requestAttorneyData } from './attorney-request';
type Attorney = {bar_number:string;name:string;company:string;city:string;county:string;status:string;admit_date:string;imported_at:string;law_school?:string;address?:string;zip?:string;phone?:string;email?:string;source_url?:string};
type Results = {attorneys:Attorney[];total:number;page:number;totalImported:number;updated:string;statuses:string[]};
export default function GeorgiaDirectory() {
 const [name,setName]=useState(''),[city,setCity]=useState(''),[status,setStatus]=useState('');
 const [query,setQuery]=useState({q:'',city:'',status:'',page:1});
 const [result,setResult]=useState<Results|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState<Attorney|null>(null),[detailLoading,setDetailLoading]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  requestAttorneyData<Results>(query,controller.signal).then(x=>{setResult(x);}).catch(e=>{if(e.name!=='AbortError')setError(e.message || 'Unable to load attorneys.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[query]);
 function changeQuery(next: typeof query) {setLoading(true);setError('');setQuery(next);}
 function search(e:FormEvent){e.preventDefault();setSelected(null);changeQuery({q:name.trim(),city:city.trim(),status,page:1});}
 async function open(a:Attorney){setSelected(a);setDetailLoading(true);setError('');try{const x=await requestAttorneyData<{attorney:Attorney}>({id:a.bar_number});setSelected(x.attorney);}catch(e){setError(e instanceof Error?e.message:'Unable to open this record.');}finally{setDetailLoading(false);}}
 const date=(s:string)=>s?new Date(s).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}):'Not listed';
 return <>
  <section className="search-band directory-search" aria-label="Georgia attorney search"><div>
   <p className="eyebrow light">Georgia attorney directory</p><h1>Know who represents you.</h1>
   <form className="directory-filters" onSubmit={search}>
    <label>Name, firm, or bar number<input value={name} onChange={e=>setName(e.target.value)} placeholder="Search Georgia attorneys" /></label>
    <label>City<input value={city} onChange={e=>setCity(e.target.value)} placeholder="Any Georgia city" /></label>
    <label>Membership status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{result?.statuses.map(s=><option key={s}>{s}</option>)}</select></label>
    <button type="submit">Search</button>
   </form>
   <p className="search-note">State Bar of Georgia records. Membership status is shown separately from client reviews.</p>
  </div></section>
  <div className="page-shell directory-page">
   {error&&<div role="alert" className="directory-error">{error} <button onClick={()=>selected ? open(selected) : changeQuery({...query})}>Try again</button> <a href="/" target="_top">Reopen CounselCheck</a></div>}
   {selected?<>
    <button className="outline-button" onClick={()=>setSelected(null)}>Back to results</button>
    <article className="profile-card directory-detail" aria-busy={detailLoading}>
     <div className="profile-heading"><div className="portrait"><span>{selected.name.split(' ').filter(Boolean).map(n=>n[0]).slice(0,2).join('')}</span></div><div className="identity"><p className="section-kicker">Georgia Bar #{selected.bar_number}</p><h2>{selected.name}</h2>{selected.company&&<p className="role">{selected.company}</p>}<p className="location">{selected.city || 'City not listed'}, Georgia</p><p className="directory-status">{selected.status}</p></div></div>
     {detailLoading?<p role="status">Loading attorney record…</p>:<div className="profile-body">
      <section className="credentials"><h3>Professional record</h3><dl><div><dt>Bar number</dt><dd>GA #{selected.bar_number}</dd></div><div><dt>Membership status</dt><dd>{selected.status}</dd></div><div><dt>Admitted</dt><dd>{date(selected.admit_date)}</dd></div><div><dt>Law school</dt><dd>{selected.law_school||'Not listed'}</dd></div><div><dt>County</dt><dd>{selected.county||'Not listed'}</dd></div></dl><p className="record-note">Imported from the State Bar directory on {date(selected.imported_at)}. Status may change after this date.</p><a href={selected.source_url} target="_blank" rel="noreferrer">View official bar record</a></section>
      <section><h3>Public contact information</h3>{selected.address&&<address>{selected.address}<br/>{selected.city}, GA {selected.zip}</address>}{selected.phone&&<p><a href={'tel:'+selected.phone.replace(/[^+\d]/g,'')}>{selected.phone}</a></p>}{selected.email&&<p><a href={'mailto:'+selected.email}>{selected.email}</a></p>}{!selected.address&&!selected.phone&&!selected.email&&<p>Contact information is not published in the directory.</p>}<h3 className="directory-review-heading">Client reviews</h3><p>No client reviews have been collected for this attorney.</p></section>
     </div>}
    </article>
   </>:<>
    <div className="section-heading directory-results-heading"><div><p className="section-kicker">Attorney records</p><h2>{loading?'Loading results…':`${(result?.total||0).toLocaleString()} ${result?.total===1?'attorney':'attorneys'}`}</h2></div>{result&&<p>{result.totalImported.toLocaleString()} Georgia records imported<br/><small>Updated {date(result.updated)}</small></p>}</div>
    {loading?<p role="status">Loading Georgia attorneys…</p>:result?.attorneys.length?<>
     <div className="directory-grid">{result.attorneys.map(a=><article className="profile-card directory-result" key={a.bar_number}><p className="section-kicker">GA #{a.bar_number}</p><h3><button onClick={()=>open(a)}>{a.name}</button></h3>{a.company&&<p>{a.company}</p>}<p className="location">{a.city||'City not listed'}, Georgia</p><p className="directory-status">{a.status}</p><button className="outline-button" onClick={()=>open(a)}>View profile</button></article>)}</div>
     <div className="directory-pagination"><button className="outline-button" disabled={query.page<=1} onClick={()=>changeQuery({...query,page:query.page-1})}>Previous</button><span>Page {query.page} of {Math.ceil(result.total/25).toLocaleString()}</span><button className="outline-button" disabled={query.page*25>=result.total} onClick={()=>changeQuery({...query,page:query.page+1})}>Next</button></div>
    </>:<p>{result?.totalImported?'No attorneys match your search. Try another name, city, or status.':'Georgia records have not been imported yet.'}</p>}
   </>}
  </div>
 </>;
}
