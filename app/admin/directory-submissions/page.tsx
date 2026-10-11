'use client';
import {useEffect,useState} from 'react';
import SiteHeader from '../../SiteHeader';

type Submission={id:string;kind:string;name:string;firm_name:string;state:string;bar_number:string;city:string;website:string;official_source_url:string;submitter_name:string;submitter_email:string;notes:string;verification_status:string;verification_note:string;status:string;review_note:string;submitted_at:string};
async function request(payload:Record<string,unknown>){
 const response=await fetch('/api/directory-submissions',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;
}
function SubmissionCard({item,onReviewed}:{item:Submission;onReviewed:()=>void}){
 const [verified,setVerified]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function review(decision:'approve'|'reject'){setBusy(true);setError('');try{await request({action:'review',id:item.id,decision,officiallyVerified:verified,reviewNote:note});onReviewed();}catch(e){setError(e instanceof Error?e.message:'Review failed.');}finally{setBusy(false);}}
 return <article className="review-card directory-submission-card"><p className="section-kicker">{item.status} · {item.kind} · {item.state}</p><h2>{item.name}</h2><p>{item.firm_name}{item.city&&(item.firm_name?' · ':'')+item.city}{item.bar_number&&` · License #${item.bar_number}`}</p><p className={'source-check '+item.verification_status}><strong>Automated source check:</strong> {item.verification_status.replaceAll('_',' ')}<br/>{item.verification_note}</p><dl><div><dt>Submitted by</dt><dd>{item.submitter_name} · {item.submitter_email}</dd></div>{item.website&&<div><dt>Website</dt><dd><a href={item.website} target="_blank" rel="noreferrer">{item.website}</a></dd></div>}<div><dt>Submitted</dt><dd>{new Date(item.submitted_at).toLocaleString()}</dd></div></dl>{item.notes&&<><h3>Notes</h3><p>{item.notes}</p></>}<a className="outline-button" href={item.official_source_url} target="_blank" rel="noreferrer">Open official source</a>{item.status==='pending'?<><label className="claim-attestation"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>I checked the official licensing record or firm roster and confirmed this submission is accurate.</span></label><label>Private review note<textarea rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<div className="form-actions"><button className="gold-button" disabled={busy||!verified} onClick={()=>review('approve')}>Approve for import</button><button className="outline-button" disabled={busy} onClick={()=>review('reject')}>Reject</button></div></>:<p>{item.review_note}</p>}</article>;
}
export default function DirectorySubmissions(){
 const [items,setItems]=useState<Submission[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const data=await request({action:'list'});setItems(data.submissions);}catch(e){setError(e instanceof Error?e.message:'Unable to load submissions.');}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 return <main><SiteHeader/><div className="page-shell account-page"><p className="section-kicker">OWNER ADMINISTRATION</p><h1>Directory submissions</h1><p>Every suggestion stays out of the public directory until its official source has been checked and it is approved for import.</p>{error&&<div className="directory-error" role="alert">{error} <button onClick={load}>Try again</button></div>}{loading?<p role="status">Loading submissions…</p>:items.length?items.map(item=><SubmissionCard key={item.id} item={item} onReviewed={load}/>):<div className="chart-empty"><h2>No directory suggestions yet.</h2></div>}</div></main>;
}
