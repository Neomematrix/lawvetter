import {rawDb} from '../../../db/raw';
import {profileIdentity,sameOrigin} from '../../../db/profile-access';

const failure=(error:string,status=400)=>Response.json({error},{status});
const trustedRegistryDomains=[
 'calbar.ca.gov','apps.calbar.ca.gov','texasbar.com','iardc.org','mywsba.org','wsba.org',
 'floridabar.org','gabar.org','alabar.org','azbar.org','arkbar.com','ctbar.org','dcbar.org',
 'delawarebar.org','hawaiibar.org','idaho.gov','isba.org','kscourts.org','kybar.org',
 'lsba.org','mainebar.org','massbbo.org','mdcourts.gov','michbar.org','mnbar.org',
 'msbar.org','mobar.org','montanabar.org','nebar.com','nvbar.org','nhbar.org',
 'njcourts.gov','nmbar.org','nysba.org','ncbar.gov','sband.org','ohiobar.org',
 'okbar.org','osbar.org','pacourts.us','ribar.com','sccourts.org','sdbar.org',
 'tncourts.gov','utahbar.org','vtbar.org','vsb.org','wvbar.org','wisbar.org','wyomingbar.org'
];

function text(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function safeHttps(value:string){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname==='localhost'||/^\d+(?:\.\d+){3}$/.test(url.hostname))return null;
  return url;
 }catch{return null;}
}
function trustedOfficialHost(hostname:string){
 const host=hostname.toLowerCase();
 return host.endsWith('.gov')||host.endsWith('.us')||trustedRegistryDomains.some(domain=>host===domain||host.endsWith('.'+domain));
}
function normalized(value:string){return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();}
async function checkOfficialSource(kind:string,name:string,barNumber:string,url:URL){
 if(!trustedOfficialHost(url.hostname))return {status:'manual_official_check_required',note:'The source is saved, but its domain is not on the automated official-registry allowlist.'};
 try{
  const response=await fetch(url.toString(),{headers:{'User-Agent':'LawVetter directory verification/1.0'},redirect:'follow',signal:AbortSignal.timeout(7000)});
  if(!response.ok)return {status:'manual_official_check_required',note:`The official source returned HTTP ${response.status}; owner review is required.`};
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('text/'))return {status:'official_source_reachable',note:'The official source is reachable; the owner must confirm the record.'};
  const body=normalized((await response.text()).slice(0,750000));
  const nameParts=normalized(name).split(' ').filter(part=>part.length>2);
  const nameMatch=nameParts.length>0&&nameParts.every(part=>body.includes(part));
  const barMatch=!barNumber||body.includes(normalized(barNumber));
  if(nameMatch&&barMatch)return {status:'registry_match',note:kind==='lawyer'?'The official page contains the submitted name and license number. Owner approval is still required.':'The official source contains the submitted firm name. Owner approval is still required.'};
  return {status:'official_source_reachable',note:'The official page is reachable, but an exact record match needs owner confirmation.'};
 }catch{return {status:'manual_official_check_required',note:'The official source could not be read automatically; owner review is required.'};}
}

export async function POST(request:Request){
 try{
  const data=await request.json() as Record<string,unknown>;
  if(!data||Array.isArray(data)||!sameOrigin(request))return failure('Invalid request.',403);
  const action=text(data.action,30),db=rawDb();
  if(action==='submit'){
   if(text(data.companyWebsite,100))return Response.json({submitted:true});
   const kind=text(data.kind,20),name=text(data.name,180),firmName=text(data.firmName,180),state=text(data.state,2).toUpperCase();
   const barNumber=text(data.barNumber,80),city=text(data.city,120),website=text(data.website,500),officialSourceUrl=text(data.officialSourceUrl,700);
   const submitterName=text(data.submitterName,150),submitterEmail=text(data.submitterEmail,254).toLowerCase(),notes=text(data.notes,2500);
   if(!['lawyer','firm'].includes(kind)||name.length<2||!/^([A-Z]{2}|DC)$/.test(state)||submitterName.length<2||!/^\S+@\S+\.\S+$/.test(submitterEmail))return failure('Complete the required contact and listing information.');
   if(kind==='lawyer'&&!barNumber)return failure('Enter the lawyer’s state license or bar number.');
   const source=safeHttps(officialSourceUrl);if(!source)return failure('Use a complete HTTPS link to an official regulator, court, bar, or firm roster.');
   if(website&&!safeHttps(website))return failure('Use a complete HTTPS website address.');
   const since=new Date(Date.now()-86400000).toISOString();
   const recent=await db.prepare('SELECT COUNT(*) AS total FROM directory_submissions WHERE submitter_email=? AND submitted_at>=?').bind(submitterEmail,since).first<{total:number}>();
   if(Number(recent?.total||0)>=8)return failure('Submission limit reached. Please try again tomorrow.',429);
   const duplicate=await db.prepare("SELECT id FROM directory_submissions WHERE kind=? AND state=? AND lower(name)=lower(?) AND (bar_number=? OR bar_number='') AND status IN ('pending','approved_for_import') LIMIT 1").bind(kind,state,name,barNumber).first();
   if(duplicate)return failure('This listing has already been submitted for review.',409);
   const verification=await checkOfficialSource(kind,name,barNumber,source),id=crypto.randomUUID(),now=new Date().toISOString();
   await db.prepare("INSERT INTO directory_submissions(id,kind,name,firm_name,state,bar_number,city,website,official_source_url,submitter_name,submitter_email,notes,verification_status,verification_note,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)").bind(id,kind,name,firmName,state,barNumber,city,website,source.toString(),submitterName,submitterEmail,notes,verification.status,verification.note,now).run();
   return Response.json({submitted:true,id,verificationStatus:verification.status});
  }
  const {user,admin}=profileIdentity(request);
  if(!user||!admin)return failure('Only the site owner can review directory submissions.',403);
  if(action==='list'){
   const rows=await db.prepare("SELECT * FROM directory_submissions ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,submitted_at DESC LIMIT 300").all();
   return Response.json({submissions:rows.results},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(action==='review'){
   const id=text(data.id,80),decision=text(data.decision,20),reviewNote=text(data.reviewNote,2000);
   if(!id||!['approve','reject'].includes(decision))return failure('Invalid review.');
   if(decision==='approve'&&data.officiallyVerified!==true)return failure('Confirm the official licensing or roster source before approval.');
   const status=decision==='approve'?'approved_for_import':'rejected',now=new Date().toISOString();
   const result=await db.prepare("UPDATE directory_submissions SET status=?,review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").bind(status,reviewNote,now,user,id).run();
   if(!result.meta.changes)return failure('This submission was already reviewed.',409);
   return Response.json({saved:true});
  }
  return failure('Unknown action.');
 }catch(error){console.error('Directory submission failed',error);return failure('Directory submissions are temporarily unavailable. Please try again.',503);}
}
