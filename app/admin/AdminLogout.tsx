'use client';
import {clearAdminDraft} from './records/record-draft';
import {useState} from 'react';
export default function AdminLogout(){const [error,setError]=useState(''),[busy,setBusy]=useState(false);async function logout(){setBusy(true);try{const r=await fetch('/api/admin/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw Error();clearAdminDraft();location.assign('/admin');}catch{setError('Sign out failed. Please try again.');setBusy(false);}}return <div className="admin-logout">{error&&<span role="alert">{error}</span>}<button className="admin-button" disabled={busy} onClick={logout}>Sign out</button></div>;}
