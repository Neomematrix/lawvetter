'use client';
import BackupTools from './BackupTools';
import launchStyles from './launch.css?url';
import {useEffect,useState,type FormEvent} from 'react';
type Settings={origin:string;gaMeasurementId:string;googleVerification:string;bingVerification:string};
export default function LaunchSettings(){
 const [coverage,setCoverage]=useState<{quality:{total:number;withPracticeAreas:number;uploadedPhotos:number;withContact:number};conversion:{approvedClaims:number;referrals:number;handledReferrals:number}}|null>(null);
 const [settings,setSettings]=useState<Settings|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/admin/launch',{cache:'no-store'}),d=await r.json() as {error?:string;settings:Settings;quality:NonNullable<typeof coverage>['quality'];conversion:NonNullable<typeof coverage>['conversion']};if(!r.ok)throw Error(d.error);setSettings(d.settings);setCoverage(d);}catch(e){setError(e instanceof Error?e.message:'Unable to load settings.');}}
 useEffect(()=>{void load();},[]);
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/admin/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)}),d=await r.json() as {error?:string;settings:Settings};if(!r.ok)throw Error(d.error);setSettings(d.settings);setMessage('Launch settings saved. Public pages now use this configuration.');}catch(e){setError(e instanceof Error?e.message:'Unable to save settings.');}finally{setBusy(false);}}
 return <div className="admin-content admin-launch">
  <link rel="stylesheet" href={launchStyles} precedence="admin-launch"/>
  <header className="launch-heading"><div><p className="launch-eyebrow">SITE GROWTH</p><h1>Launch &amp; indexing</h1><p>Manage your website, search visibility, and backups in one place.</p></div><a className="admin-button" href="/" target="_blank" rel="noreferrer">View website</a></header>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {message&&<p role="status" className="success-message">{message}</p>}
  {!settings&&!error&&<p role="status">Loading settings…</p>}
  {coverage&&<section className="admin-panel launch-coverage" aria-labelledby="directory-quality-title">
   <div className="launch-section-heading"><div><p className="launch-eyebrow">DIRECTORY HEALTH</p><h2 id="directory-quality-title">Directory quality and growth</h2><p>A clear view of profile completeness and attorney engagement.</p></div><a className="admin-button" href="/admin/records">Improve directory records</a></div>
   <dl className="launch-metrics">{[
    ['Attorney records',coverage.quality.total],['With practice areas',coverage.quality.withPracticeAreas],['Uploaded photos',coverage.quality.uploadedPhotos],['With phone or email',coverage.quality.withContact]
   ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString()}</dd></div>)}</dl>
   <dl className="launch-engagement"><div><dt>Approved profile claims</dt><dd>{coverage.conversion.approvedClaims.toLocaleString()}</dd></div><div><dt>Targeted referrals</dt><dd>{coverage.conversion.referrals.toLocaleString()}</dd></div><div><dt>Referrals with follow-up</dt><dd>{coverage.conversion.handledReferrals.toLocaleString()}</dd></div></dl>
   <p className="launch-footnote">Prioritize practice areas, photos, contact details, and biographies. Counts reflect saved records, including supplied or sourced practice areas, rather than verified unique people.</p>
  </section>}
  <div className="launch-settings-grid">
   {settings&&<form className="admin-panel launch-settings" onSubmit={save} aria-labelledby="public-settings-title">
    <div className="launch-section-heading"><div><p className="launch-eyebrow">WEBSITE &amp; ANALYTICS</p><h2 id="public-settings-title">Public settings</h2><p>Choose your primary domain and connect visitor tracking.</p></div></div>
    <div className="launch-fields">
     <label>Primary website<select value={settings.origin} onChange={e=>setSettings({...settings,origin:e.target.value})} aria-describedby="launch-domain-help"><option value="https://www.lawvetter.com">www.lawvetter.com</option><option value="https://lawvetter.com">lawvetter.com</option></select><small id="launch-domain-help">Your preferred address for public pages and search results.</small></label>
     <label>Google Analytics measurement ID<input value={settings.gaMeasurementId} onChange={e=>setSettings({...settings,gaMeasurementId:e.target.value})} placeholder="G-XXXXXXXXXX" maxLength={30} aria-describedby="launch-analytics-help"/><small id="launch-analytics-help">Find this in Google Analytics → Admin → Data streams → your Web stream.</small></label>
    </div>
    <div className="launch-form-section"><h3>Search engine verification</h3><p>Connect your domain to Google Search Console and Bing Webmaster Tools.</p><div className="launch-fields">
     <label>Google verification token<input value={settings.googleVerification} onChange={e=>setSettings({...settings,googleVerification:e.target.value})} maxLength={150} spellCheck={false}/></label>
     <label>Bing verification token<input value={settings.bingVerification} onChange={e=>setSettings({...settings,bingVerification:e.target.value})} maxLength={150} spellCheck={false}/></label>
    </div></div>
    <div className="launch-actions"><span>Changes apply to your public website.</span><button className="admin-button primary" disabled={busy}>{busy?'Saving…':'Save launch settings'}</button></div>
   </form>}
   <section className="admin-panel launch-search" aria-labelledby="search-checks-title">
    <p className="launch-eyebrow">SEARCH VISIBILITY</p><h2 id="search-checks-title">Search engine checks</h2><p>Review the files search engines use to discover your pages.</p>
    <div className="launch-resource-links"><a href="/robots.txt" target="_blank" rel="noreferrer"><strong>Crawler rules</strong><span>Review robots.txt</span></a><a href="/sitemap.xml" target="_blank" rel="noreferrer"><strong>Sitemap index</strong><span>View pages available to index</span></a></div>
    <p className="launch-search-note">Verify your domain in Google Search Console and Bing Webmaster Tools, then submit the sitemap index. DNS ownership verification also works without a page token.</p>
    <details className="launch-details"><summary>Before switching domains</summary><p>Activate your domain only after DNS, HTTPS, and the Turnstile hostname settings are ready. The site checks that your chosen domain serves LawVetter before changing canonical URLs and redirects.</p><p>Add lawvetter.com and www.lawvetter.com to your Cloudflare Turnstile widget. Keep the current site hostname during the transition. Sign in separately on your new domain to test accounts and forms.</p></details>
   </section>
  </div>
  <BackupTools/>
 </div>;
}
