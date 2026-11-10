'use client';
import {useState,type FormEvent} from 'react';
export default function BackupTools(){const [password,setPassword]=useState(''),[passphrase,setPassphrase]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[key,setKey]=useState('');async function create(e:FormEvent){e.preventDefault();setError('');setKey('');if(passphrase!==confirm){setError('Backup passphrases do not match.');return;}setBusy(true);try{const r=await fetch('/api/admin/backups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,passphrase})}),d=await r.json() as {error?:string;backup:{key:string}};if(!r.ok)throw Error(d.error);setKey(d.backup.key);setPassword('');setPassphrase('');setConfirm('');}catch(e){setError(e instanceof Error?e.message:'Unable to create backup.');}finally{setBusy(false);}}return <section className="admin-panel launch-backup" aria-labelledby="backup-title">
 <div className="launch-section-heading"><div><p className="launch-eyebrow">DATA PROTECTION</p><h2 id="backup-title">Encrypted data backup</h2><p>Keep a protected copy of your directory, accounts, reviews, and uploaded files.</p></div><span className="launch-security-label">Encrypted export</span></div>
 <div className="launch-backup-note"><strong>Keep your passphrase somewhere safe.</strong><p>LawVetter never stores it. You will need it to decrypt your backup.</p></div>
 <form onSubmit={create}>
  <div className="launch-fields launch-backup-fields">
   <label>Admin password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Separate backup passphrase<input type="password" autoComplete="new-password" required minLength={16} maxLength={256} value={passphrase} onChange={e=>setPassphrase(e.target.value)} aria-describedby="backup-passphrase-help"/><small id="backup-passphrase-help">Use at least 16 characters.</small></label>
   <label>Confirm backup passphrase<input type="password" autoComplete="new-password" required minLength={16} maxLength={256} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
  </div>
  <div className="launch-actions"><span>Create backups during a quiet period.</span><button className="admin-button primary" disabled={busy}>{busy?'Creating encrypted backup…':'Create encrypted backup'}</button></div>
 </form>
 {error&&<p role="alert" className="admin-error">{error}</p>}
 {key&&<p role="status" className="success-message">Encrypted backup saved. <a href={'/api/admin/backups?key='+encodeURIComponent(key)}>Download your backup</a></p>}
 <details className="launch-details"><summary>What is included and how to restore</summary><p>The export includes directory records, accounts, reviews, private verification evidence, uploaded photos, and the runtime settings needed for restoration. Active sessions and temporary login tokens are excluded.</p><p>Validate a restore before relying on a backup. Restore testing uses the source code’s scripts/restore-backup.mjs tool in a separate local directory. It does not overwrite the live site.</p></details>
 </section>;}
