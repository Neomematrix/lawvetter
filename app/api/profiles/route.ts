import {rawDb} from '../../../db/raw';
import {profileIdentity,sameOrigin} from '../../../db/profile-access';
const failure=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 try{
  const data=await request.json() as Record<string,unknown>;
  if(!data||Array.isArray(data))return failure('Invalid request.');
  const {user,email,admin}=profileIdentity(request),db=rawDb();
  const action=String(data.action||''),bar=typeof data.bar==='string'?data.bar:'';
  if(action==='view'){
   const profile=await db.prepare('SELECT bar_number,headline,bio,practice_areas,website,photo_key,claimed_at,updated_at FROM attorney_profiles WHERE bar_number=?').bind(bar).first();
   const owned=user?await db.prepare('SELECT bar_number FROM attorney_profiles WHERE bar_number=? AND owner_id=?').bind(bar,user).first():null;
   const claim=user?await db.prepare('SELECT status,review_note FROM profile_claims WHERE bar_number=? AND user_id=? ORDER BY submitted_at DESC LIMIT 1').bind(bar,user).first():null;
   return Response.json({profile,isOwner:!!owned,claim,signedIn:!!user,isAdmin:admin},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(!user||!email)return failure('Sign in with ChatGPT to claim or manage an attorney profile.',401);
  if(!sameOrigin(request))return failure('Invalid request origin.',403);
  if(action==='account'){
   const [profiles,claims]=await Promise.all([
    db.prepare('SELECT p.*,a.name,a.company FROM attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number WHERE p.owner_id=? ORDER BY a.name').bind(user).all(),
    db.prepare('SELECT c.bar_number,c.status,c.review_note,c.submitted_at,a.name FROM profile_claims c JOIN attorneys a ON a.bar_number=c.bar_number WHERE c.user_id=? ORDER BY c.submitted_at DESC').bind(user).all()
   ]);return Response.json({profiles:profiles.results,claims:claims.results,isAdmin:admin});
  }
  if(action==='claim'){
   const fullName=typeof data.fullName==='string'?data.fullName.trim():'',verification=typeof data.verification==='string'?data.verification.trim():'';
   if(!/^\d{1,20}$/.test(bar)||fullName.length<3||fullName.length>150||verification.length<20||verification.length>2000||data.attestation!==true)return failure('Complete your name, verification details, and ownership confirmation.');
   const a=await db.prepare('SELECT bar_number FROM attorneys WHERE bar_number=?').bind(bar).first();if(!a)return failure('Attorney not found.',404);
   if(await db.prepare('SELECT bar_number FROM attorney_profiles WHERE bar_number=?').bind(bar).first())return failure('This profile has already been claimed. Contact the site owner to resolve ownership.',409);
   const id=JSON.stringify([user,bar]);
   const old=await db.prepare('SELECT status FROM profile_claims WHERE id=?').bind(id).first<{status:string}>();
   if(old?.status==='pending')return failure('Your claim is already awaiting review.',409);
   await db.prepare("INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,review_note,submitted_at) VALUES(?,?,?,?,?,?,'pending','',?) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,verification=excluded.verification,status='pending',review_note='',submitted_at=excluded.submitted_at,reviewed_at=NULL,reviewed_by=NULL").bind(id,bar,user,email,fullName,verification,new Date().toISOString()).run();
   return Response.json({status:'pending'});
  }
  if(action==='save'){
   const fields=['headline','bio','practiceAreas','website'] as const;
   if(fields.some(f=>typeof data[f]!=='string'))return failure('Invalid profile fields.');
   const headline=(data.headline as string).trim(),bio=(data.bio as string).trim(),practice=(data.practiceAreas as string).trim(),website=(data.website as string).trim();
   if(headline.length>160||bio.length>5000||practice.length>500||website.length>500)return failure('A profile field is too long.');
   if(website){try{const u=new URL(website);if(u.protocol!=='https:'||u.username||u.password)throw new Error();}catch{return failure('Use a complete https:// website address.');}}
   const changed=await db.prepare('UPDATE attorney_profiles SET headline=?,bio=?,practice_areas=?,website=?,updated_at=? WHERE bar_number=? AND owner_id=?').bind(headline,bio,practice,website,new Date().toISOString(),bar,user).run();
   if(!changed.meta.changes)return failure('Only the approved profile owner can edit this attorney.',403);
   return Response.json({saved:true});
  }
  if(action==='review-list'){
   if(!admin)return failure('Only the site owner can review claims.',403);
   const rows=await db.prepare("SELECT c.*,a.name,a.email AS directory_email,a.phone AS directory_phone,a.source_url,a.status AS bar_status,a.company FROM profile_claims c JOIN attorneys a ON a.bar_number=c.bar_number ORDER BY CASE WHEN c.status='pending' THEN 0 ELSE 1 END,c.submitted_at DESC LIMIT 200").all();return Response.json({claims:rows.results});
  }
  if(action==='review'){
   if(!admin)return failure('Only the site owner can review claims.',403);
   if(typeof data.id!=='string'||!['approve','reject'].includes(String(data.decision)))return failure('Invalid review.');
   const note=typeof data.note==='string'?data.note.trim().slice(0,2000):'';
   const claim=await db.prepare("SELECT * FROM profile_claims WHERE id=? AND status='pending'").bind(data.id).first<{bar_number:string;user_id:string}>();if(!claim)return failure('This claim has already been reviewed or no longer exists.',409);
   const now=new Date().toISOString();
   if(data.decision==='approve'){
    if(data.verified!==true)return failure('Verify the attorney’s identity and authority before approving.');
    const existing=await db.prepare('SELECT owner_id FROM attorney_profiles WHERE bar_number=?').bind(claim.bar_number).first<{owner_id:string}>();if(existing&&existing.owner_id!==claim.user_id)return failure('Another owner already controls this profile.',409);
    await db.batch([
     db.prepare("INSERT OR IGNORE INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) SELECT bar_number,user_id,?,? FROM profile_claims WHERE id=? AND status='pending'").bind(now,now,data.id),
     db.prepare("UPDATE profile_claims SET status='approved',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=profile_claims.bar_number AND p.owner_id=profile_claims.user_id)").bind(note,now,user,data.id),
     db.prepare("UPDATE profile_claims SET status='rejected',review_note='Another claim for this profile was approved.',reviewed_at=?,reviewed_by=? WHERE bar_number=? AND id<>? AND status='pending' AND EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=profile_claims.bar_number)").bind(now,user,claim.bar_number,data.id)
    ]);
    const result=await db.prepare('SELECT status FROM profile_claims WHERE id=?').bind(data.id).first<{status:string}>();if(result?.status!=='approved')return failure('The profile was claimed by another account during review.',409);
   }else await db.prepare("UPDATE profile_claims SET status='rejected',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").bind(note,now,user,data.id).run();
   return Response.json({saved:true});
  }
  return failure('Unknown profile action.');
 }catch(error){console.error('Profile operation failed',error);return failure('Profile services are temporarily unavailable. Please try again.',503);}
}
