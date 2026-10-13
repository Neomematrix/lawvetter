import {licensedAttorney,directoryAttorneyId} from '../../../db/attorney-identity';
import {directoryFirmName} from '../../../db/directory-firm';
import {submissionInput,checkSubmissionPhoto,saveSubmissionPhoto,discardSubmissionPhoto} from '../../../db/directory-upload';
import {publishDirectoryListing,reconcileApprovedListings,type Listing} from '../../../db/publish-directory';
import {directoryDetails,withDirectoryDetails} from '../../../db/directory-details';
import {notifyDirectorySubmission,retryDirectoryNotices} from '../../../db/directory-notification';
import {allowDirectoryAttempt,checkDirectoryCaptcha,directoryCaptchaConfig} from '../../../db/directory-protection';
import {clientIdentity,allowAuth} from '../../../db/client-auth';
import {decodeAttorneyDraft,encodeAttorneyDraft} from '../../../db/attorney-submission';
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

export function GET(){const c=directoryCaptchaConfig();return Response.json({captchaEnabled:c.enabled,siteKey:c.siteKey},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
 try{
  let input:Awaited<ReturnType<typeof submissionInput>>;try{input=await submissionInput(request);}catch(e){const message=e instanceof Error?e.message:'Invalid submission.';return failure(message,message.includes('too large')?413:400);}const {data,photo}=input;
  if(!data||Array.isArray(data)||!sameOrigin(request))return failure('Invalid request.',403);
  const action=text(data.action,30),db=rawDb();
  if(action==='publish-approved-records'){if(!await allowDirectoryAttempt(request,'directory-publication-repair',3))return failure('Please wait before retrying.',429);return Response.json({published:await reconcileApprovedListings()});}
  if(action==='retry-notifications'){if(!await allowDirectoryAttempt(request,'directory-notification-retry',3))return failure('Please wait before retrying notifications.',429);return Response.json({accepted:await retryDirectoryNotices(new URL(request.url).origin)});}
  if(action==='submit'){
   if(!await allowDirectoryAttempt(request))return failure('Too many submissions. Please try again in an hour.',429);
   const captchaError=await checkDirectoryCaptcha(request,data.captchaToken);if(captchaError)return failure(captchaError,400);
   if(text(data.companyWebsite,100))return failure('Submission could not be accepted.');
   const kind=text(data.kind,20),name=text(data.name,180),firmName=text(data.firmName,180),state=text(data.state,2).toUpperCase();
   const barNumber=text(data.barNumber,80),city=text(data.city,120),website=text(data.website,500),officialSourceUrl=text(data.officialSourceUrl,700);
   const client=data.attorneyProfile===true?await clientIdentity(request):null;
   if(data.attorneyProfile===true&&!client)return failure('Log in before submitting your attorney profile.',401);
   if(client&&(!await allowAuth(request,client.email)))return failure('Too many attempts. Please try again in 15 minutes.',429);
   const submitterName=text(data.submitterName,150),submitterEmail=client?.email||text(data.submitterEmail,254).toLowerCase();
   const firmWebsite=text(data.firmWebsite,500);if(firmWebsite&&(!firmName||!safeHttps(firmWebsite)))return failure('Enter the firm name and a complete HTTPS firm website.');
   if(data.practiceAreas!==undefined&&(typeof data.practiceAreas!=='string'||data.practiceAreas.length>500))return failure('Practice areas must be text of 500 characters or fewer.');
   const practiceAreas=kind==='lawyer'?text(data.practiceAreas,500):'';
   let notes=text(data.notes,2500);if(!client&&notes.startsWith('LAWVETTER_'))return failure('Invalid notes.');
   if(client){
    if(kind!=='lawyer'||state!=='GA'||!/^\d{1,20}$/.test(barNumber)||data.attestation!==true)return failure('Confirm your identity and enter your Georgia bar number.');
    if(await licensedAttorney(state,barNumber))return failure('Your profile is already listed. Search for it and submit a claim instead.',409);
    const publicEmail=text(data.publicEmail,254);if(publicEmail&&!/^\S+@\S+\.\S+$/.test(publicEmail))return failure('Enter a valid public contact email.');
    const admitDate=text(data.admitDate,10);if(admitDate&&!/^\d{4}-\d{2}-\d{2}$/.test(admitDate))return failure('Enter a valid admission date.');
    notes=encodeAttorneyDraft({owner:client.user,headline:text(data.headline,160),bio:text(data.bio,5000),practiceAreas:text(data.practiceAreas,500),photoKey:'',firmWebsite,phone:text(data.phone,80),publicEmail,address:text(data.address,500),county:text(data.county,120),admitDate,lawSchool:text(data.lawSchool,180),notes});
   }
   if(photo&&(kind!=='lawyer'||data.photoConsent!==true))return failure('Confirm permission to publish the attorney photo.');
   let checkedPhoto:Awaited<ReturnType<typeof checkSubmissionPhoto>>;try{checkedPhoto=await checkSubmissionPhoto(photo);}catch(e){return failure(e instanceof Error?e.message:'Invalid photo.');}
   if(!['lawyer','firm'].includes(kind)||name.length<2||!/^([A-Z]{2}|DC)$/.test(state)||submitterName.length<2||!/^\S+@\S+\.\S+$/.test(submitterEmail))return failure('Complete the required contact and listing information.');
   if(kind==='lawyer'&&!barNumber)return failure('Enter the lawyer’s state license or bar number.');
   const source=safeHttps(officialSourceUrl);if(!source)return failure('Use a complete HTTPS link to an official regulator, court, bar, or firm roster.');
   if(website&&!safeHttps(website))return failure('Use a complete HTTPS website address.');
   notes=withDirectoryDetails(notes,{firmWebsite,practiceAreas});
   const since=new Date(Date.now()-86400000).toISOString();
   const recent=await db.prepare('SELECT COUNT(*) AS total FROM directory_submissions WHERE submitter_email=? AND submitted_at>=?').bind(submitterEmail,since).first<{total:number}>();
   if(Number(recent?.total||0)>=8)return failure('Submission limit reached. Please try again tomorrow.',429);
   const duplicate=await db.prepare("SELECT id FROM directory_submissions WHERE kind=? AND state=? AND lower(name)=lower(?) AND (bar_number=? OR bar_number='') AND status IN ('pending','approved_for_import') LIMIT 1").bind(kind,state,name,barNumber).first();
   if(duplicate)return failure('This listing has already been submitted for review.',409);
   const verification=await checkOfficialSource(kind,name,barNumber,source),id=crypto.randomUUID(),now=new Date().toISOString();
   const photoKey=await saveSubmissionPhoto(id,checkedPhoto);if(photoKey)notes=withDirectoryDetails(notes,{photoKey});
   try{await db.prepare("INSERT INTO directory_submissions(id,kind,name,firm_name,state,bar_number,city,website,official_source_url,submitter_name,submitter_email,notes,verification_status,verification_note,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)").bind(id,kind,name,firmName,state,barNumber,city,website,source.toString(),submitterName,submitterEmail,notes,verification.status,verification.note,now).run();}catch(e){await discardSubmissionPhoto(photoKey);throw e;}
   const notificationEmailStatus=await notifyDirectorySubmission(id,new URL(request.url).origin);return Response.json({submitted:true,id,verificationStatus:verification.status,notificationEmailStatus});
  }
  const {user,admin}=profileIdentity(request);
  if(!user||!admin)return failure('Only the site owner can review directory submissions.',403);
  if(action==='list'){await reconcileApprovedListings();await retryDirectoryNotices(new URL(request.url).origin);
   const rows=await db.prepare("SELECT * FROM directory_submissions ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,submitted_at DESC LIMIT 300").all();
   return Response.json({submissions:rows.results},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(action==='review'||action==='publish-approved'){
   const id=text(data.id,80),decision=text(data.decision,20),reviewNote=text(data.reviewNote,2000);
   if(!id||!['approve','reject'].includes(decision))return failure('Invalid review.');
   if(decision==='approve'&&data.officiallyVerified!==true)return failure('Confirm the official licensing or roster source before approval.');
   const status=decision==='approve'?'approved_for_import':'rejected',now=new Date().toISOString();
   const item=await db.prepare("SELECT * FROM directory_submissions WHERE id=? AND status IN ('pending','approved_for_import')").bind(id).first<Listing>(),draft=item&&decodeAttorneyDraft(item.notes);
   if(action==='publish-approved'&&item?.status!=='approved_for_import')return failure('This listing is not awaiting publication.',409);
   if(item?.kind==='lawyer'&&!draft&&decision==='approve'){try{await publishDirectoryListing(item,text(data.barStatus,100),user,reviewNote);return Response.json({saved:true,published:true});}catch(e){return failure(e instanceof Error?e.message:'Unable to publish.',409);}}
   if(draft&&decision==='approve'){
    if(item!.state!=='GA'||!/^\d{1,20}$/.test(item!.bar_number))return failure('This profile requires a Georgia record.');
    const barStatus=text(data.barStatus,100);if(!['Active Member in Good Standing','Inactive Member','Suspended','Disbarred','Deceased'].includes(barStatus))return failure('Select the membership status you verified in the official record.');
    if(await licensedAttorney(item!.state,item!.bar_number))return failure('This attorney is now in the directory. Reject the duplicate and ask the attorney to claim the existing record.',409);
    if(data.identityVerified!==true)return failure('Confirm the submitting attorney’s identity and authority to manage this profile.');
    const firmName=await directoryFirmName(item!.firm_name),attorneyId=await directoryAttorneyId(item!.state,item!.bar_number);
    const created=await db.batch([
     db.prepare("INSERT INTO attorneys(bar_number,license_number,source_id,name,company,city,state,county,status,admit_date,law_school,address,phone,email,source_url,imported_at) SELECT ?,bar_number,'owner-reviewed:'||id,name,?,city,state,?,?,?,?,?,?,?,?,? FROM directory_submissions WHERE id=? AND status='pending' AND notes=?").bind(attorneyId,firmName,draft.county,barStatus,draft.admitDate,draft.lawSchool,draft.address,draft.phone,draft.publicEmail,item!.official_source_url,now,id,item!.notes),
     db.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,headline,bio,practice_areas,website,photo_key,claimed_at,updated_at) SELECT ?,?,?,?,?,website,?,?,? FROM directory_submissions WHERE id=? AND status='pending' AND notes=?").bind(attorneyId,draft.owner,draft.headline,draft.bio,draft.practiceAreas,draft.photoKey,now,now,id,item!.notes),
     db.prepare("UPDATE directory_submissions SET status='published',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending' AND notes=?").bind(reviewNote,now,user,id,item!.notes)
    ]);if(!created[2].meta.changes)return failure('This submission changed during review. Reload and verify its latest details.',409);return Response.json({saved:true});
   }

   const result=await db.prepare("UPDATE directory_submissions SET status=?,review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").bind(status,reviewNote,now,user,id).run();
   if(!result.meta.changes)return failure('This submission was already reviewed.',409);
   return Response.json({saved:true});
  }
  return failure('Unknown action.');
 }catch(error){console.error('Directory submission failed',error);return failure('Directory submissions are temporarily unavailable. Please try again.',503);}
}
