import {normalizeLanguages} from '../../languages';
import {sendClaimApproval} from '../../../db/claim-approval-email';
import {attorneyFirmSettings} from '../../../db/submitted-firm';
import {publicRecords} from '../../../db/public-records';
import {resolveAttorneyReference} from '../../../db/attorney-reference';
import {attorneyLinkedIn} from '../../firm-websites';
import {linkedInUrl} from '../../../app/linkedin-url';
import {env} from 'cloudflare:workers';
import {submissionInput} from '../../../db/directory-upload';
import {validateFirmEmail,claimEvidence,sendClaimConfirmation} from '../../../db/claim-verification';
import {validAttorneyId} from '../../attorney-identity';
import {clientIdentity} from '../../../db/client-auth';
import {decodeAttorneyDraft} from '../../../db/attorney-submission';
import {rawDb} from '../../../db/raw';
import {profileIdentity,sameOrigin} from '../../../db/profile-access';
const failure=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 try{
  let data:Record<string,unknown>,evidence:File|null;try{const parsed=await submissionInput(request);data=parsed.data;evidence=parsed.photo;}catch{return failure('Invalid claim or request. Upload JPEG, PNG, or PDF files smaller than 3 MB.');}
  const platform=(await profileIdentity(request)),client=await clientIdentity(request),passwordOnly=data.authentication==='password';
  const {user,email}=client||(!passwordOnly?platform:{user:'',email:''}),admin=!passwordOnly&&platform.admin,db=rawDb();
  const action=String(data.action||''),bar=typeof data.bar==='string'?await resolveAttorneyReference(data.bar):'';
  if(action==='view'){
   const profile=await db.prepare('SELECT bar_number,languages,headline,bio,practice_areas,website,linkedin_url,photo_key,claimed_at,updated_at FROM attorney_profiles WHERE bar_number=?').bind(bar).first();
   const firmWebsite=await attorneyFirmSettings(bar);
   const owned=user?await db.prepare('SELECT bar_number FROM attorney_profiles WHERE bar_number=? AND owner_id=?').bind(bar,user).first():null;
   const claim=user?await db.prepare('SELECT status,review_note,firm_email,firm_email_verified_at,evidence_name FROM profile_claims WHERE bar_number=? AND user_id=? ORDER BY submitted_at DESC LIMIT 1').bind(bar,user).first():null;
   const ownsAnother=user?!!await db.prepare("SELECT 1 FROM attorney_profiles WHERE owner_id=? AND bar_number<>? AND claimed_at<>'' LIMIT 1").bind(user,bar).first():false;
   return Response.json({canClaim:!ownsAnother,profile:admin||owned?profile:await publicRecords(profile),firmWebsite:firmWebsite?.website??null,firmLinkedInUrl:firmWebsite?.linkedin_url??null,isOwner:!!owned,claim,signedIn:!!user,isAdmin:admin},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(!user||!email)return failure('Log in to claim or manage an attorney profile.',401);
  if(!sameOrigin(request))return failure('Invalid request origin.',403);
  if(action==='account'){
   const [profiles,claims]=await Promise.all([
    db.prepare('SELECT p.*,a.public_id,a.name,a.company,a.state,a.license_number FROM attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number WHERE p.owner_id=? ORDER BY a.name').bind(user).all(),
    db.prepare('SELECT c.bar_number,c.status,c.review_note,c.submitted_at,a.name,a.state FROM profile_claims c JOIN attorneys a ON a.bar_number=c.bar_number WHERE c.user_id=? ORDER BY c.submitted_at DESC').bind(user).all()
   ]);const submitted=await db.prepare('SELECT id,name,bar_number,status,review_note,notes FROM directory_submissions WHERE submitter_email=? ORDER BY submitted_at DESC').bind(email).all<{id:string;name:string;bar_number:string;status:string;review_note:string;notes:string}>();return Response.json({profiles:profiles.results.map(p=>({...p,linkedin_url:(p as {linkedin_url?:string|null}).linkedin_url??attorneyLinkedIn[(p as {bar_number:string}).bar_number]??''})),claims:await publicRecords(claims.results),isAdmin:admin,submissions:submitted.results.filter(r=>decodeAttorneyDraft(r.notes)?.owner===user).map(({notes,...r})=>r)},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(action==='resend-claim-email'){const id=JSON.stringify([user,bar]);if(!await db.prepare("SELECT id FROM profile_claims WHERE id=? AND status='pending'").bind(id).first())return failure('Pending claim not found.',404);return Response.json({emailStatus:await sendClaimConfirmation(id,new URL(request.url).origin)});}
  if(action==='claim'){
   if(await db.prepare("SELECT 1 FROM attorney_profiles WHERE owner_id=? AND bar_number<>? AND claimed_at<>'' LIMIT 1").bind(user,bar).first())return failure('Your account already manages an attorney profile.',409);
   const fullName=typeof data.fullName==='string'?data.fullName.trim():'',verification=typeof data.verification==='string'?data.verification.trim():'';
   if(!validAttorneyId(bar)||fullName.length<3||fullName.length>150||verification.length<20||verification.length>2000||data.attestation!==true)return failure('Complete your name, verification details, and ownership confirmation.');
   const a=await db.prepare('SELECT bar_number FROM attorneys WHERE bar_number=?').bind(bar).first();if(!a)return failure('Attorney not found.',404);
   if(await db.prepare("SELECT bar_number FROM attorney_profiles WHERE bar_number=? AND owner_id<>''").bind(bar).first())return failure('This profile has already been claimed. Contact the site owner to resolve ownership.',409);
   let firmEmail:string,proof:Awaited<ReturnType<typeof claimEvidence>>;try{firmEmail=validateFirmEmail(data.firmEmail);proof=await claimEvidence(evidence);}catch(e){return failure(e instanceof Error?e.message:'Invalid verification evidence.');}
   const id=JSON.stringify([user,bar]);
   const old=await db.prepare('SELECT status FROM profile_claims WHERE id=?').bind(id).first<{status:string}>();
   if(old?.status==='pending')return failure('Your claim is already awaiting review.',409);
   const evidenceKey=proof?'claim-evidence/'+crypto.randomUUID()+proof.extension:'';
   if(proof)await env.PROFILE_PHOTOS.put(evidenceKey,proof.bytes,{httpMetadata:{contentType:proof.type}});
   try{await db.prepare("INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,firm_email,evidence_key,evidence_name,evidence_type,status,review_note,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,'pending','',?) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,verification=excluded.verification,firm_email=excluded.firm_email,firm_email_verified_at=NULL,email_token_hash='',email_token_expires=0,email_sent_at=0,evidence_key=excluded.evidence_key,evidence_name=excluded.evidence_name,evidence_type=excluded.evidence_type,status='pending',review_note='',submitted_at=excluded.submitted_at,reviewed_at=NULL,reviewed_by=NULL").bind(id,bar,user,email,fullName,verification,firmEmail,evidenceKey,proof?.name||'',proof?.type||'',new Date().toISOString()).run();}catch(e){if(evidenceKey)await env.PROFILE_PHOTOS.delete(evidenceKey);throw e;}
   return Response.json({status:'pending',emailStatus:await sendClaimConfirmation(id,new URL(request.url).origin)});
  }
  if(action==='save'){
   let languages:string|undefined;try{if(data.languages!==undefined)languages=normalizeLanguages(data.languages);}catch(e){return failure((e as Error).message);}
   if(data.hideBarNumber!==undefined&&typeof data.hideBarNumber!=='boolean')return failure('Invalid bar number visibility.');
   const fields=['headline','bio','practiceAreas','website'] as const;
   if(fields.some(f=>typeof data[f]!=='string'))return failure('Invalid profile fields.');
   const headline=(data.headline as string).trim(),bio=(data.bio as string).trim(),practice=(data.practiceAreas as string).trim(),website=(data.website as string).trim();
   if(headline.length>160||bio.length>5000||practice.length>500||website.length>500)return failure('A profile field is too long.');
   if(website){try{const u=new URL(website);if(u.protocol!=='https:'||u.username||u.password)throw new Error();}catch{return failure('Use a complete https:// website address.');}}
   let linkedin:string|undefined;try{linkedin=linkedInUrl(data.linkedinUrl,'attorney');}catch(e){return failure(e instanceof Error?e.message:'Invalid LinkedIn URL.');}const changed=await db.prepare('UPDATE attorney_profiles SET languages=COALESCE(?,languages),headline=?,bio=?,practice_areas=?,website=?,linkedin_url=COALESCE(?,linkedin_url),hide_bar_number=COALESCE(?,hide_bar_number),updated_at=? WHERE bar_number=? AND owner_id=?').bind(languages??null,headline,bio,practice,website,linkedin??null,1,new Date().toISOString(),bar,user).run();
   if(!changed.meta.changes)return failure('Only the approved profile owner can edit this attorney.',403);
   return Response.json({saved:true});
  }
  if(action==='review-list'){
   if(!admin)return failure('Only the site owner can review claims.',403);
   const query=typeof data.query==='string'?data.query.trim().slice(0,150):'',status=['pending','approved','rejected'].includes(String(data.status))?String(data.status):'all';
   const filters:string[]=[],bindings:string[]=[];
   if(status!=='all'){filters.push('c.status=?');bindings.push(status);}
   if(query){filters.push("(instr(lower(a.name),lower(?))>0 OR instr(lower(c.full_name),lower(?))>0 OR instr(lower(c.email),lower(?))>0 OR instr(lower(a.state),lower(?))>0 OR instr(lower(c.bar_number),lower(?))>0)");bindings.push(...Array(5).fill(query));}
   const where=filters.length?' WHERE '+filters.join(' AND '):'',join=' FROM profile_claims c JOIN attorneys a ON a.bar_number=c.bar_number';
   const total=Number((await db.prepare('SELECT COUNT(*) AS total'+join+where).bind(...bindings).first<{total:number}>())?.total||0),pageSize=20;
   const requested=Number(data.page),page=Math.min(Math.max(1,Number.isFinite(requested)?Math.floor(requested):1),Math.max(1,Math.ceil(total/pageSize)));
   const rows=await db.prepare("SELECT c.*,a.name,a.state,a.email AS directory_email,a.phone AS directory_phone,a.source_url,a.status AS bar_status,a.company"+join+where+" ORDER BY CASE WHEN c.status='pending' THEN 0 ELSE 1 END,CASE WHEN c.status='pending' THEN c.submitted_at END ASC,c.submitted_at DESC,c.id ASC LIMIT ? OFFSET ?").bind(...bindings,pageSize,(page-1)*pageSize).all();
   const counts=await db.prepare('SELECT status,COUNT(*) AS total FROM profile_claims GROUP BY status').all<{status:string;total:number}>();
   return Response.json({claims:rows.results,total,page,pageSize,counts:Object.fromEntries(counts.results.map(r=>[r.status,r.total]))},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(action==='resend-approval-email'){
   if(!admin)return failure('Only the site owner can send claim approval messages.',403);
   if(typeof data.id!=='string')return failure('Invalid claim.');
   return Response.json({emailStatus:await sendClaimApproval(data.id)});
  }
  if(action==='review'){
   if(!admin)return failure('Only the site owner can review claims.',403);
   if(typeof data.id!=='string'||!['approve','reject'].includes(String(data.decision)))return failure('Invalid review.');
   const note=typeof data.note==='string'?data.note.trim().slice(0,2000):'';
   const claim=await db.prepare("SELECT * FROM profile_claims WHERE id=? AND status='pending'").bind(data.id).first<{bar_number:string;user_id:string;firm_email:string;firm_email_verified_at:string|null}>();if(!claim)return failure('This claim has already been reviewed or no longer exists.',409);
   const now=new Date().toISOString();
   if(data.decision==='approve'){
    if(claim.firm_email&&!claim.firm_email_verified_at)return failure('The claimant must confirm their firm email before ownership can be approved.');
    if(data.verified!==true)return failure('Verify the attorney’s identity and authority before approving.');
    const existing=await db.prepare('SELECT owner_id FROM attorney_profiles WHERE bar_number=?').bind(claim.bar_number).first<{owner_id:string}>();if(existing&&existing.owner_id&&existing.owner_id!==claim.user_id)return failure('Another owner already controls this profile.',409);
    await db.batch([
     db.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) SELECT bar_number,user_id,?,? FROM profile_claims WHERE id=? AND status='pending' ON CONFLICT(bar_number) DO UPDATE SET owner_id=excluded.owner_id,claimed_at=excluded.claimed_at,updated_at=excluded.updated_at WHERE attorney_profiles.owner_id='' OR attorney_profiles.owner_id=excluded.owner_id").bind(now,now,data.id),
     db.prepare("UPDATE profile_claims SET status='approved',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=profile_claims.bar_number AND p.owner_id=profile_claims.user_id)").bind(note,now,user,data.id),
     db.prepare("UPDATE profile_claims SET status='rejected',review_note='Another claim for this profile was approved.',reviewed_at=?,reviewed_by=? WHERE bar_number=? AND id<>? AND status='pending' AND EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=profile_claims.bar_number)").bind(now,user,claim.bar_number,data.id)
    ]);
    const result=await db.prepare('SELECT status FROM profile_claims WHERE id=?').bind(data.id).first<{status:string}>();if(result?.status!=='approved')return failure('The profile was claimed by another account during review.',409);
    return Response.json({saved:true,emailStatus:await sendClaimApproval(data.id)});
   }else await db.prepare("UPDATE profile_claims SET status='rejected',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").bind(note,now,user,data.id).run();
   return Response.json({saved:true});
  }
  return failure('Unknown profile action.');
 }catch(error){console.error('Profile operation failed',error);return failure('Profile services are temporarily unavailable. Please try again.',503);}
}
