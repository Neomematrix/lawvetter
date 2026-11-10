import {normalizeLanguages} from '../../languages';
import {sendDirectoryApproval,retryDirectoryApprovals} from '../../../db/directory-approval-email';
import {requireFirmSubmission} from '../../firm-submission-requirements';
import {practiceCatalog} from '../../../db/practice-categories';
import {submittedFirmStatement} from '../../../db/submitted-firm';
import {isActiveMembership} from '../../membership-status';
import {normalizeBarNumber,requireGeorgiaIdentity,georgiaBarProfile} from '../../attorney-identity';
import {membershipStatus} from '../../membership-status';
import {requireAttorneyLocation} from '../../attorney-location';
import {linkedInUrl} from '../../linkedin-url';
import {firmKey} from '../attorneys/firm';
import {directoryInsertGuard,licenseKey,firmDeletionKey} from '../../../db/directory-deletions';
import {splitPracticeAreas,practiceCategoryId,practiceAreaChoices} from '../../practice-category';
import {invalidPlainText} from '../../../db/form-input';
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
  if(nameMatch&&barMatch)return {status:'registry_match',note:kind==='lawyer'?(barNumber?'The official page contains the submitted name and license number. Owner approval is still required.':'The official page contains the submitted name. Owner approval is still required.'):'The official source contains the submitted firm name. Owner approval is still required.'};
  return {status:'official_source_reachable',note:'The official page is reachable, but an exact record match needs owner confirmation.'};
 }catch{return {status:'manual_official_check_required',note:'The official source could not be read automatically; owner review is required.'};}
}

export function GET(){const c=directoryCaptchaConfig();return Response.json({captchaEnabled:c.enabled,captchaRequired:c.required,siteKey:c.siteKey},{headers:{'Cache-Control':'no-store'}});}
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
   if(invalidPlainText(data,['kind','name','firmName','state','barNumber','city','website','officialSourceUrl','submitterName','submitterEmail','firmWebsite','linkedinUrl','firmLinkedInUrl','practiceAreas','biography','notes','headline','bio','phone','publicEmail','address','zip','county','admitDate','lawSchool','membershipStatus']))return failure('Enter plain text in the form fields. HTML and scripts are not accepted.');
   const kind=text(data.kind,20),name=text(data.name,180),firmName=text(data.firmName,180),state=text(data.state,2).toUpperCase();
   if(kind==='firm'){try{requireFirmSubmission(data);}catch(e){return failure((e as Error).message);}}
   if(kind==='lawyer'){try{requireAttorneyLocation(data.city,data.state);}catch(e){return failure((e as Error).message);}}
   let barNumber=text(data.barNumber,80);if(kind==='lawyer'&&barNumber){try{barNumber=normalizeBarNumber(state,barNumber);}catch(e){return failure((e as Error).message);}}const city=text(data.city,120),website=text(data.website,500),officialSourceUrl=text(data.officialSourceUrl,700);
   if(kind==='lawyer'&&!officialSourceUrl)return failure('Please add official member directory link.');
   const client=data.attorneyProfile===true?await clientIdentity(request):null;
   if(data.attorneyProfile===true&&!client)return failure('Log in before submitting your attorney profile.',401);
   if(client&&(!await allowAuth(request,client.email)))return failure('Too many attempts. Please try again in 15 minutes.',429);
   const submitterName=text(data.submitterName,150),submitterEmail=client?.email||text(data.submitterEmail,254).toLowerCase();
   const firmWebsite=text(data.firmWebsite,500);if(firmWebsite&&(!firmName||!safeHttps(firmWebsite)))return failure('Enter the firm name and a complete HTTPS firm website.');
   if(data.practiceAreas!==undefined&&(typeof data.practiceAreas!=='string'||data.practiceAreas.length>500))return failure('Practice areas must be text of 500 characters or fewer.');
   let linkedin:string|undefined,firmLinkedin:string|undefined;try{linkedin=linkedInUrl(data.linkedinUrl,kind==='lawyer'?'attorney':'firm');firmLinkedin=linkedInUrl(data.firmLinkedInUrl,'firm');}catch(e){return failure(e instanceof Error?e.message:'Invalid LinkedIn URL.');}let practiceAreas=kind==='lawyer'?text(data.practiceAreas,500):'';
   if(kind==='lawyer'){const selected=splitPracticeAreas(practiceAreas);if(!selected.length)return failure('Select at least one practice area from the list.');const catalog=await practiceCatalog(db),allowed=new Map([...practiceAreaChoices(),...catalog.areas].map(area=>[area.name.toLowerCase(),area.name]));const names=selected.map(name=>allowed.get(name.toLowerCase()));if(names.some(name=>!name))return failure('Select practice areas from the available options.');practiceAreas=names.join(', ');}
   let languages='';try{if(kind==='lawyer')languages=normalizeLanguages(data.languages);}catch(e){return failure((e as Error).message);}
   let notes=text(data.notes,2500);if(!client&&notes.startsWith('LAWVETTER_'))return failure('Invalid notes.');
   if(client){
    if(!splitPracticeAreas(practiceAreas).some(area=>practiceCategoryId(area)))return failure('Select at least one practice area.');
    if(kind!=='lawyer'||state!=='GA'||(barNumber!==''&&!/^\d{1,20}$/.test(barNumber))||data.attestation!==true)return failure('Confirm your identity and enter your Georgia bar number.');
    if(await licensedAttorney(state,barNumber,officialSourceUrl))return failure('Your profile is already listed. Search for it and submit a claim instead.',409);
    const publicEmail=text(data.publicEmail,254);if(publicEmail&&!/^\S+@\S+\.\S+$/.test(publicEmail))return failure('Enter a valid public contact email.');
    const admitDate=text(data.admitDate,10);if(admitDate&&!/^\d{4}-\d{2}-\d{2}$/.test(admitDate))return failure('Enter a valid admission date.');
    notes=encodeAttorneyDraft({languages,owner:client.user,headline:text(data.headline,160),bio:text(data.bio,5000),practiceAreas:text(data.practiceAreas,500),photoKey:'',linkedinUrl:linkedin,firmLinkedInUrl:firmLinkedin,firmWebsite,phone:text(data.phone,80),publicEmail,address:text(data.address,500),county:text(data.county,120),admitDate,lawSchool:text(data.lawSchool,180),notes});
   }
   let checkedPhoto:Awaited<ReturnType<typeof checkSubmissionPhoto>>;try{checkedPhoto=await checkSubmissionPhoto(photo,kind==='firm');}catch(e){return failure(e instanceof Error?e.message:'Invalid photo.');}
   if(!['lawyer','firm'].includes(kind)||name.length<2||!/^([A-Z]{2}|DC)$/.test(state)||submitterName.length<2||!/^\S+@\S+\.\S+$/.test(submitterEmail))return failure('Complete the required contact and listing information.');
   if(kind==='lawyer'){try{requireGeorgiaIdentity(state,barNumber,officialSourceUrl);}catch(e){return failure((e as Error).message);}if(await licensedAttorney(state,barNumber,officialSourceUrl))return failure('This attorney is already listed. Request a correction or claim the existing profile.',409);}
   const source=kind==='lawyer'?safeHttps(state==='GA'?(georgiaBarProfile(officialSourceUrl)||officialSourceUrl):officialSourceUrl):null;if(kind==='lawyer'&&!source)return failure('Use a complete HTTPS link to an official regulator, court, bar, or firm roster.');
   if(website&&!safeHttps(website))return failure('Use a complete HTTPS website address.');
   const admitDate=kind==='lawyer'?text(data.admitDate,10):'';if(admitDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(admitDate)||Number.isNaN(Date.parse(admitDate))||new Date(admitDate).toISOString().slice(0,10)!==admitDate||admitDate>new Date().toISOString().slice(0,10)))return failure('Enter a valid bar admission date that is not in the future.');
   if(kind==='lawyer'&&data.membershipStatus!==undefined&&data.membershipStatus!=='Member in Good Standing')return failure('Membership status must be Member in Good Standing.');
   const zip=text(data.zip,10);if(zip&&!/^\d{5}(-\d{4})?$/.test(zip))return failure('Enter a 5-digit ZIP code or ZIP+4.');
   const publicEmail=text(data.publicEmail,254);if(publicEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail))return failure('Enter a valid public contact email.');
   notes=withDirectoryDetails(notes,{biography:text(data.biography,2500),...(kind==='lawyer'?{languages,admitDate,lawSchool:text(data.lawSchool,180),membershipStatus:'Member in Good Standing'}:{}),firmWebsite,practiceAreas,zip,address:text(data.address,500),county:text(data.county,120),phone:text(data.phone,80),publicEmail,linkedinUrl:linkedin,firmLinkedInUrl:firmLinkedin});
   const since=new Date(Date.now()-86400000).toISOString();
   const recent=await db.prepare('SELECT COUNT(*) AS total FROM directory_submissions WHERE submitter_email=? AND submitted_at>=?').bind(submitterEmail,since).first<{total:number}>();
   if(Number(recent?.total||0)>=8)return failure('Submission limit reached. Please try again tomorrow.',429);
   const duplicate=await db.prepare("SELECT id FROM directory_submissions WHERE kind=? AND state=? AND lower(name)=lower(?) AND (bar_number=? OR bar_number='') AND status IN ('pending','approved_for_import') LIMIT 1").bind(kind,state,name,barNumber).first();
   if(duplicate)return failure('This listing has already been submitted for review.',409);
   const verification=kind==='lawyer'?await checkOfficialSource(kind,name,barNumber,source!):{status:'manual_firm_review_required',note:'Firm information is waiting for administrator review.'},id=crypto.randomUUID(),now=new Date().toISOString();
   const photoKey=await saveSubmissionPhoto(id,checkedPhoto);if(photoKey)notes=withDirectoryDetails(notes,{photoKey});
   try{await db.prepare("INSERT INTO directory_submissions(id,kind,name,firm_name,state,bar_number,city,website,official_source_url,submitter_name,submitter_email,notes,verification_status,verification_note,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)").bind(id,kind,name,firmName,state,barNumber,city,website,source?.toString()||'',submitterName,submitterEmail,notes,verification.status,verification.note,now).run();}catch(e){await discardSubmissionPhoto(photoKey);throw e;}
   const notificationEmailStatus=await notifyDirectorySubmission(id,new URL(request.url).origin);return Response.json({submitted:true,id,verificationStatus:verification.status,notificationEmailStatus});
  }
  const {user,admin}=(await profileIdentity(request));
  if(!user||!admin)return failure('Only the site owner can review directory submissions.',403);
  if(action==='list'){await retryDirectoryApprovals();await reconcileApprovedListings();await retryDirectoryNotices(new URL(request.url).origin);
   const rows=await db.prepare("SELECT directory_submissions.*,(SELECT bar_number FROM attorneys WHERE source_id='owner-reviewed:'||directory_submissions.id LIMIT 1) AS published_record_id FROM directory_submissions ORDER BY CASE WHEN status IN ('pending','approved_for_import') THEN 0 ELSE 1 END,CASE WHEN status IN ('pending','approved_for_import') THEN submitted_at END ASC,submitted_at DESC LIMIT 300").all();
   return Response.json({submissions:rows.results},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(action==='review'||action==='publish-approved'){
   const id=text(data.id,80),decision=text(data.decision,20),reviewNote=text(data.reviewNote,2000);
   if(!id||!['approve','reject'].includes(decision))return failure('Invalid review.');
   if(decision==='approve'&&data.officiallyVerified!==true)return failure('Confirm the official licensing or roster source before approval.');
   const status=decision==='approve'?'approved_for_import':'rejected',now=new Date().toISOString();
   const originalItem=await db.prepare("SELECT * FROM directory_submissions WHERE id=? AND status IN ('pending','approved_for_import')").bind(id).first<Listing>();
   if(!originalItem)return failure('This submission was already reviewed.',409);
   const listingKind=data.listingKind===undefined?originalItem.kind:text(data.listingKind,20),listingState=data.listingState===undefined?originalItem.state:text(data.listingState,2).toUpperCase();
   if(!['lawyer','firm'].includes(listingKind)||!/^[A-Z]{2}$/.test(listingState))return failure('Choose a listing type and a two letter state code.');
   if(listingKind==='lawyer'&&listingState!==originalItem.state)return failure('Correct the attorney record before changing its licensing state.');
   if(originalItem.kind==='firm'&&listingKind!=='firm')return failure('A firm cannot be approved as an individual attorney.');
   const item=decision==='approve'?{...originalItem,kind:listingKind,state:listingState}:originalItem,draft=item.kind==='lawyer'?decodeAttorneyDraft(item.notes):null;
   if(item?.kind==='lawyer'&&decision==='approve'&&membershipStatus(text(data.barStatus,100))!=='Member in Good Standing')return failure('Membership status must be Member in Good Standing.');
   if(item?.kind==='lawyer'&&decision==='approve'){try{requireAttorneyLocation(item.city,item.state);}catch(e){return failure((e as Error).message);}}
   if(action==='publish-approved'&&item?.status!=='approved_for_import')return failure('This listing is not awaiting publication.',409);
   if(item?.kind==='lawyer'&&!draft&&decision==='approve'){try{await publishDirectoryListing(item,text(data.barStatus,100),user,reviewNote);return Response.json({saved:true,published:true,approvalEmailStatus:await sendDirectoryApproval(id)});}catch(e){return failure(e instanceof Error?e.message:'Unable to publish.',409);}}
   if(draft&&decision==='approve'){
    if(item!.state!=='GA'||(item!.bar_number!==''&&!/^\d{1,20}$/.test(item!.bar_number)))return failure('This profile requires a Georgia record.');
    requireGeorgiaIdentity(item!.state,item!.bar_number,item!.official_source_url);const barStatus=membershipStatus(text(data.barStatus,100));if(!isActiveMembership(barStatus))return failure('Only verified active members may be listed.');
    if(await licensedAttorney(item!.state,item!.bar_number,item!.official_source_url))return failure('This attorney is now in the directory. Reject the duplicate and ask the attorney to claim the existing record.',409);
    if(data.identityVerified!==true)return failure('Confirm the submitting attorney’s identity and authority to manage this profile.');
    const firmName=await directoryFirmName(item!.firm_name),attorneyId=await directoryAttorneyId(item!.state,item!.bar_number,item!.official_source_url);
    const firmStatement=submittedFirmStatement(firmName,item!.notes,id,now);
    const created=await db.batch([
     db.prepare("INSERT INTO attorneys(bar_number,license_number,source_id,name,company,city,state,county,status,admit_date,law_school,address,phone,email,source_url,imported_at) SELECT ?,NULLIF(bar_number,''),'owner-reviewed:'||id,name,?,city,state,?,?,?,?,?,?,?,?,? FROM directory_submissions WHERE id=? AND status='pending' AND notes=? AND "+directoryInsertGuard).bind(attorneyId,firmName,draft.county,barStatus,draft.admitDate,draft.lawSchool,draft.address,draft.phone,draft.publicEmail,item!.official_source_url,now,id,item!.notes,licenseKey(item!.state,item!.bar_number),firmDeletionKey(firmName)),
     db.prepare("INSERT INTO attorney_profiles(bar_number,languages,owner_id,headline,bio,practice_areas,website,linkedin_url,photo_key,claimed_at,updated_at) SELECT ?,?,?,?,?,?,website,?,?,?,? FROM directory_submissions WHERE id=? AND status='pending' AND notes=?").bind(attorneyId,normalizeLanguages(draft.languages),draft.owner,draft.headline,draft.bio,draft.practiceAreas,draft.linkedinUrl??null,draft.photoKey,now,now,id,item!.notes),
     ...(firmStatement?[firmStatement]:[]),
     db.prepare("UPDATE directory_submissions SET status='published',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending' AND notes=?").bind(reviewNote,now,user,id,item!.notes)
    ]);if(!created[created.length-1].meta.changes)return failure('This submission changed during review. Reload and verify its latest details.',409);return Response.json({saved:true,published:true,approvalEmailStatus:await sendDirectoryApproval(id)});
   }

   if(item?.kind==='firm'&&decision==='approve'){
    const details=directoryDetails(item.notes),submittedDraft=decodeAttorneyDraft(item.notes);
    if(data.firmBiography!==undefined&&(typeof data.firmBiography!=='string'||data.firmBiography.length>2500||invalidPlainText(data,['firmBiography'])))return failure('Use plain text of 2500 characters or fewer for the firm biography.');
    const firmNotes=withDirectoryDetails('',{...details,photoKey:details.photoKey||submittedDraft?.photoKey||'',biography:data.firmBiography===undefined?(details.biography??(details.notes.startsWith('Firm ownership review request.')?'':details.notes||submittedDraft?.bio||'')):text(data.firmBiography,2500),admitDate:undefined,lawSchool:undefined,membershipStatus:undefined});
    let firmLinkedin=details.firmLinkedInUrl||details.linkedinUrl;try{firmLinkedin=linkedInUrl(firmLinkedin,'firm');}catch{firmLinkedin=undefined;}
    const result=await db.batch([
     db.prepare('INSERT INTO firm_settings(key,name,website,linkedin_url,address,phone,email,city,state,zip,banner_key,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name,website=excluded.website,linkedin_url=COALESCE(excluded.linkedin_url,firm_settings.linkedin_url),address=excluded.address,phone=excluded.phone,email=excluded.email,city=excluded.city,state=excluded.state,zip=excluded.zip,banner_key=CASE WHEN excluded.banner_key=\'\' THEN firm_settings.banner_key ELSE excluded.banner_key END,updated_at=excluded.updated_at').bind(firmKey(item.name),item.name,item.website||details.firmWebsite,firmLinkedin??null,details.address||'',details.phone||'',details.publicEmail||'',item.city,item.state,details.zip||'',details.photoKey||submittedDraft?.photoKey||'',now),
     db.prepare("UPDATE directory_submissions SET kind='firm',state=?,bar_number='',official_source_url='',notes=?,status='published',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status IN ('pending','approved_for_import')").bind(item.state,firmNotes,reviewNote,now,user,id)
    ]);if(!result[1].meta.changes)return failure('This submission was already reviewed.',409);return Response.json({saved:true,published:true,approvalEmailStatus:await sendDirectoryApproval(id)});
   }
   const result=await db.prepare("UPDATE directory_submissions SET status=?,review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").bind(status,reviewNote,now,user,id).run();
   if(!result.meta.changes)return failure('This submission was already reviewed.',409);
   return Response.json({saved:true});
  }
  return failure('Unknown action.');
 }catch(error){console.error('Directory submission failed',error);return failure('Directory submissions are temporarily unavailable. Please try again.',503);}
}
