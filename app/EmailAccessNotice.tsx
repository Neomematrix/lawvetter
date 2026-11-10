 'use client';
import {useEffect,useState} from 'react';
export default function EmailAccessNotice(){
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{fetch('/api/account/email-access',{cache:'no-store'}).then(r=>r.json() as Promise<{matched?:boolean;verified?:boolean}>).then(d=>setShow(!!d.matched&&!d.verified)).catch(()=>{});},[]);
 if(!show)return null;
 async function send(){setBusy(true);try{const r=await fetch('/api/account/email-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send'})}),d=await r.json() as {error?:string};setMessage(r.ok?'Check your inbox and spam folder for the confirmation link.':d.error||'Unable to send email.');}catch{setMessage('Unable to send email. Try again.');}finally{setBusy(false);}}
 return <section className="attorney-login-card" style={{maxWidth:1100,margin:'20px auto',padding:24}} aria-label="Profile access"><strong>Your professional profile is ready</strong><p>Your email matches an attorney or firm on LawVetter. Confirm your email to receive access automatically.</p><button className="outline-button" onClick={send} disabled={busy}>{busy?'Sending…':'Send confirmation email'}</button>{message&&<p role="status">{message}</p>}</section>;
}
