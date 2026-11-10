'use client';
import {useEffect,useRef,useState} from 'react';
import {SITE_ORIGIN} from './seo';

export default function WebsiteBadgePanel({path,name,firm}:{path:string;name:string;firm?:string}) {
 const [allowed,setAllowed]=useState(!firm),[status,setStatus]=useState(''),[showCode,setShowCode]=useState(false),[expanded,setExpanded]=useState(false);
 const codeRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{setStatus('');setShowCode(false);setExpanded(false);},[path]);
 useEffect(()=>{if(!firm){setAllowed(true);return;}let active=true;setAllowed(false);fetch('/api/firm-management?'+new URLSearchParams({firm}),{cache:'no-store'}).then(async r=>{if(active&&r.ok){const data=await r.json() as {canManage?:boolean};if(active)setAllowed(!!data.canManage);}}).catch(()=>{});return()=>{active=false;};},[firm]);
 const href=SITE_ORIGIN+path;
 const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const code=`<a href="${escape(href)}" target="_blank" rel="noopener"><img src="${SITE_ORIGIN}/brand/lawvetter-website-badge.svg?v=gold2" alt="${escape(name)} on LawVetter" width="250" height="88" style="max-width:100%;height:auto;border:0;" /></a>`;
 async function copy(){try{await navigator.clipboard.writeText(code);setStatus('Embed code copied');}catch{setShowCode(true);setStatus('Select and copy the code below');requestAnimationFrame(()=>codeRef.current?.select());}}
 if(!allowed)return null;
 return <section className="website-badge-panel" aria-label="Website badge"><button className="website-badge-toggle" type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18m-12 4-2 2 2 2m6-4 2 2-2 2"/></svg><span>Website badge</span><span className="website-badge-chevron" aria-hidden="true">⌄</span></button><div className="website-badge-body" hidden={!expanded}><a className="website-badge-preview" href={href} target="_blank" rel="noopener noreferrer"><img src="/brand/lawvetter-website-badge.svg?v=gold2" width="250" height="88" alt="LawVetter brand badge"/></a><div className="website-badge-actions"><button type="button" onClick={copy}>Copy embed code</button><a href="/brand/lawvetter-website-badge.svg?v=gold2" download="LawVetter-website-badge.svg">Download SVG</a></div><details open={showCode} onToggle={e=>setShowCode(e.currentTarget.open)}><summary>Embed code</summary><textarea ref={codeRef} readOnly value={code} aria-label="Website badge embed code" onFocus={e=>e.target.select()}/><p>Paste into your website’s HTML block. The badge links to your public profile.</p></details>{status&&<p className="website-badge-status" role="status">{status}</p>}</div></section>;
}
