import {rawDb} from '../../../db/raw';
import {profileIdentity,sameOrigin} from '../../../db/profile-access';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(error:string,status=400)=>json({error},status);
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const normal=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export async function GET(request:Request){
 try{
  const bar=new URL(request.url).searchParams.get('bar')||'';
  if(!/^\d{1,20}$/.test(bar))return fail('Choose an attorney.');
  const rows=await rawDb().prepare("SELECT CASE WHEN public_mode='named' THEN legal_name ELSE 'Anonymous' END AS author,review_body AS body,published_at AS publishedAt FROM client_verifications WHERE bar_number=? AND status='approved' AND published_at IS NOT NULL AND review_body<>'' ORDER BY published_at DESC LIMIT 100").bind(bar).all();
  return json({reviews:rows.results});
 }catch{return fail('Client reviews are temporarily unavailable.',503);}
}
export async function POST(request:Request){
 try{
  const {user,email,admin}=profileIdentity(request);
  if(!user||!email)return fail('Sign in to create a client profile or manage reviews.',401);
  if(!sameOrigin(request))return fail('Invalid request origin.',403);
  const text=await request.text();if(text.length>20000)return fail('Request is too large.',413);
  let d:Record<string,unknown>;try{d=JSON.parse(text);}catch{return fail('Invalid request.');}
  if(!d||typeof d!=='object'||Array.isArray(d))return fail('Invalid request.');
  const db=rawDb(),action=str(d.action),now=new Date().toISOString();
  if(action==='account'){
   const profile=await db.prepare('SELECT legal_name,first_name,last_name,initial_docket,email,created_at FROM client_profiles WHERE user_id=?').bind(user).first();
   const rows=await db.prepare('SELECT v.id,v.bar_number,a.name AS attorney_name,v.legal_name,v.court,v.county,v.docket,v.status,v.decision_note,v.submitted_at,v.review_body,v.public_mode,v.published_at FROM client_verifications v JOIN attorneys a ON a.bar_number=v.bar_number WHERE v.user_id=? ORDER BY v.submitted_at DESC').bind(user).all();
   return json({profile,requests:rows.results,isAdmin:admin,signedInEmail:email});
  }
  if(action==='create-profile'){
   const firstName=str(d.firstName),lastName=str(d.lastName),docket=str(d.docket),submittedEmail=str(d.email).toLowerCase();
   if(!firstName||firstName.length>75||!lastName||lastName.length>75||docket.length<3||docket.length>100||!normal(docket)||d.consent!==true)return fail('Enter your first name, last name, case number, and agree to private verification.');
   if(submittedEmail!==email)return fail('Use the email address of your signed-in account. Sign in with that account to use a different email.',403);
   const existing=await db.prepare('SELECT user_id FROM client_profiles WHERE lower(trim(email))=? AND user_id<>?').bind(email,user).first();
   const registered=await db.prepare('SELECT user_id FROM client_account_emails WHERE email=?').bind(email).first<{user_id:string}>();
   if(existing||(registered&&registered.user_id!==user))return fail('A client profile already uses this email. Sign in with the original account.',409);
   const name=firstName+' '+lastName;
   await db.batch([
    db.prepare('INSERT OR IGNORE INTO client_profiles(user_id,legal_name,email,created_at,first_name,last_name,initial_docket) VALUES(?,?,?,?,?,?,?)').bind(user,name,email,now,firstName,lastName,docket),
    db.prepare('INSERT INTO client_account_emails(email,user_id) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM client_account_emails WHERE email=? AND user_id=?)').bind(email,user,email,user)
   ]);
   return json({saved:true});
  }
  if(action==='request'){
   const bar=str(d.bar),court=str(d.court),county=str(d.county),docket=str(d.docket);
   if(!/^\d{1,20}$/.test(bar)||court.length<3||court.length>150||county.length<3||county.length>80||docket.length<3||docket.length>100||!normal(docket)||d.attestation!==true)return fail('Enter the attorney, Georgia court, county, and case docket number, and confirm you were this attorney’s client.');
   const profile=await db.prepare('SELECT legal_name FROM client_profiles WHERE user_id=?').bind(user).first<{legal_name:string}>();
   if(!profile)return fail('Create your private client profile first.',403);
   if(!await db.prepare('SELECT bar_number FROM attorneys WHERE bar_number=?').bind(bar).first())return fail('Attorney not found.',404);
   const id=JSON.stringify([user,bar]),key=JSON.stringify([normal(county),normal(court),normal(docket),normal(profile.legal_name),bar]);
   const result=await db.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'pending',?,?) ON CONFLICT(id) DO UPDATE SET court=excluded.court,county=excluded.county,docket=excluded.docket,relationship_key=excluded.relationship_key,status='pending',submitted_at=excluded.submitted_at,updated_at=excluded.updated_at,decision_note='',reviewed_at=NULL,reviewed_by=NULL,source_url='',identity_evidence='',representation_evidence='' WHERE client_verifications.status='rejected'").bind(id,user,bar,profile.legal_name,court,county,docket,key,now,now).run();
   if(!result.meta.changes)return fail('This attorney already has a pending, approved, or revoked request on your account.',409);
   await db.prepare('INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,user,'submitted','Client requested relationship verification.',now).run();
   return json({saved:true,status:'pending'});
  }
  if(action==='publish'){
   const body=str(d.body),mode=str(d.mode),id=str(d.id);
   if(body.length<30||body.length>4000||!['named','anonymous'].includes(mode)||d.consent!==true)return fail('Write 30–4,000 characters, choose your public name setting, and confirm publication.');
   const r=await db.prepare("UPDATE client_verifications SET review_body=?,public_mode=?,published_at=COALESCE(published_at,?),updated_at=? WHERE id=? AND user_id=? AND status='approved'").bind(body,mode,now,now,id,user).run();
   if(!r.meta.changes)return fail('Only the approved client can publish a review for this attorney.',403);
   return json({saved:true});
  }
  if(action==='withdraw'){
   const r=await db.prepare('UPDATE client_verifications SET review_body=\'\',published_at=NULL,updated_at=? WHERE id=? AND user_id=?').bind(now,str(d.id),user).run();
   return r.meta.changes?json({saved:true}):fail('Review not found.',404);
  }
  if(action==='admin-list'){
   if(!admin)return fail('Only the site owner can access client verification records.',403);
   const rows=await db.prepare("SELECT v.*,p.email,a.name AS attorney_name FROM client_verifications v JOIN client_profiles p ON p.user_id=v.user_id JOIN attorneys a ON a.bar_number=v.bar_number ORDER BY CASE WHEN v.status='pending' THEN 0 ELSE 1 END,v.submitted_at DESC LIMIT 200").all();
   return json({requests:rows.results});
  }
  if(action==='decide'){
   if(!admin)return fail('Only the site owner can verify clients.',403);
   const id=str(d.id),decision=str(d.decision),note=str(d.note),source=str(d.source),identity=str(d.identityEvidence),representation=str(d.representationEvidence);
   if(!['approve','reject','revoke'].includes(decision)||note.length<5||note.length>1000)return fail('Select a decision and enter a short note for the client.');
   if(decision==='approve'){
    let validSource=false;try{const u=new URL(source);validSource=u.protocol==='https:'&&u.hostname==='researchga.tylerhost.net'&&!u.username&&!u.password&&!u.pathname.startsWith('/auth/');}catch{}
    if(!validSource||identity.length<20||identity.length>2000||representation.length<20||representation.length>2000||d.identityChecked!==true||d.relationshipChecked!==true||d.recordChecked!==true)return fail('Independently verify identity, check the court record and attorney–client relationship, and record both evidence notes plus a re:SearchGA case-page URL (not a login URL).');
   }
   const status=decision==='approve'?'approved':decision==='reject'?'rejected':'revoked';
   const previous=decision==='revoke'?'approved':'pending';
   const r=await db.prepare("UPDATE client_verifications SET status=?,decision_note=?,source_url=?,identity_evidence=?,representation_evidence=?,reviewed_at=?,reviewed_by=?,updated_at=? WHERE id=? AND status=? AND user_id<>? AND (?<>'approved' OR NOT EXISTS(SELECT 1 FROM client_verifications other WHERE other.relationship_key=client_verifications.relationship_key AND other.id<>client_verifications.id AND other.status='approved'))").bind(status,note,source,identity,representation,now,user,now,id,previous,user,status).run();
   if(!r.meta.changes)return fail('Cannot approve your own request, reuse an approved relationship, or change a request that is no longer in the expected state.',409);
   await db.prepare('INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,user,status,JSON.stringify({note,source,identity,representation}),now).run();
   return json({saved:true});
  }
  return fail('Unknown action.');
 }catch{return fail('Client review services are temporarily unavailable. Please try again.',503);}
}
