'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
type Preview={from:string;to:string;subject:string;text:string;fingerprint:string;sent:boolean};
export default function ProfileInvitations(){
 const params=useSearchParams(),userId=params.get('user')||'';
 const [url,setUrl]=useState(params.get('profile')||''),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const publicId=url.match(/(?:-lv-|^)([a-f0-9]{32})\/?$/)?.[1]||'';
 async function request(action:'preview'|'send'){
  setBusy(true);setError('');setMessage('');
  try{const response=await fetch('/api/admin/profile-invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,userId,publicId,fingerprint:preview?.fingerprint})}),data=await response.json() as Preview&{error?:string};if(!response.ok)throw Error(data.error||'Unable to send.');if(action==='preview')setPreview(data);else{setPreview(p=>p?{...p,sent:true}:p);setMessage('Message accepted by LawVetter’s email provider.');}}catch(e){setError(e instanceof Error?e.message:'Unable to send.');}finally{setBusy(false);}
 }
 return <main className="admin-content"><div className="admin-heading"><div><p className="admin-eyebrow">PROFILE ACCESS</p><h1>Invite an attorney to claim their profile</h1><p>Send from LawVetter to this account’s signup email. Verification is still required before access is granted.</p></div></div><section className="admin-panel"><a href="/admin/records?kind=clients">Back to accounts</a>{!userId?<p>Select an account’s “Invite to claim” button first.</p>:<><form className="admin-form" onSubmit={e=>{e.preventDefault();void request('preview');}}><label>Attorney profile link<input required value={url} disabled={busy} onChange={e=>{setUrl(e.target.value);setPreview(null);setMessage('');}} placeholder="Paste the LawVetter attorney profile link"/></label><button className="admin-button" disabled={busy||!publicId}>Preview email</button></form>{preview&&<section aria-label="Email preview"><p><strong>From:</strong> {preview.from}</p><p><strong>To:</strong> {preview.to}</p><p><strong>Subject:</strong> {preview.subject}</p><div style={{whiteSpace:'pre-wrap',lineHeight:1.65,margin:'20px 0'}}>{preview.text}</div><button className="admin-button primary" disabled={busy||preview.sent} onClick={()=>void request('send')}>{preview.sent?'Already sent':busy?'Sending…':'Send from LawVetter'}</button></section>}</>}{error&&<p className="admin-error" role="alert">{error}</p>}{message&&<p className="admin-message" role="status">{message}</p>}</section></main>;
}
