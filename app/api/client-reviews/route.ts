import {validAttorneyId} from '../../attorney-identity';
import {moderationRecipient,moderationPayload,sendModerationEmail} from '../../../db/review-moderation-email';
import {adminUrl,accountUrl} from '../../../db/mail-markup';
import {emailConfigured,sendApprovalEmail,sendRejectionEmail} from '../../../db/approval-email';
import {reviewRatingCategories} from '../../review-ratings';
import {usStates} from '../../us-states';
import {clientIdentity,allowAuth} from '../../../db/client-auth';
import {rawDb} from '../../../db/raw';
import {profileIdentity,sameOrigin} from '../../../db/profile-access';
import {sendLatestVerificationRequestEmail,sendVerificationRequestEmail,verificationRequestEmailConfigured,verificationRequestRecipient} from '../../../db/verification-request-email';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(error:string,status=400)=>json({error},status);
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const normal=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export async function GET(request:Request){
 try{
  const url=new URL(request.url),bar=url.searchParams.get('bar')||'',offset=Number(url.searchParams.get('offset')||'0');
  if(url.searchParams.has('bars')){
   const bars=[...new Set((url.searchParams.get('bars')||'').split(','))];
   if(!bars.length||bars.length>50||bars.some(value=>!validAttorneyId(value)))return fail('Choose up to 50 attorneys.');
   const rows=await rawDb().prepare("SELECT v.bar_number,count(*) AS total,AVG(CASE WHEN v.rating_use_again IS NOT NULL AND v.rating_cared_for IS NOT NULL AND v.rating_rights IS NOT NULL AND v.rating_outcome IS NOT NULL THEN (v.rating_use_again+v.rating_cared_for+v.rating_rights+v.rating_outcome)/4.0 END) AS average,(SELECT latest.review_body FROM client_verifications latest WHERE latest.bar_number=v.bar_number AND latest.status='approved' AND latest.published_at IS NOT NULL AND latest.review_body<>'' ORDER BY latest.published_at DESC,latest.rowid DESC LIMIT 1) AS excerpt FROM client_verifications v WHERE v.bar_number IN ("+bars.map(()=>'?').join(',')+") AND v.status='approved' AND v.published_at IS NOT NULL AND v.review_body<>'' GROUP BY v.bar_number").bind(...bars).all<{bar_number:string;total:number;average:number|null;excerpt:string}>();
   return json({summaries:rows.results.map(row=>({...row,excerpt:row.excerpt.length>160?row.excerpt.slice(0,160).replace(/\s+\S*$/,'')+'…':row.excerpt}))});
  }
  if(!validAttorneyId(bar))return fail('Choose an attorney.');
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return fail('Invalid review page.');
  const db=rawDb(),where="bar_number=? AND status='approved' AND published_at IS NOT NULL AND review_body<>''";
  const [rows,summary]=await Promise.all([
   db.prepare("SELECT CASE WHEN public_mode='named' THEN legal_name ELSE 'Anonymous verified client' END AS author,public_mode='anonymous' AS anonymous,review_body AS body,published_at AS publishedAt,rating_use_again,rating_cared_for,rating_rights,rating_outcome FROM client_verifications WHERE "+where+" ORDER BY published_at DESC,rowid DESC LIMIT 5 OFFSET ?").bind(bar,offset).all(),
   db.prepare("SELECT count(*) AS total,AVG(CASE WHEN rating_use_again IS NOT NULL AND rating_cared_for IS NOT NULL AND rating_rights IS NOT NULL AND rating_outcome IS NOT NULL THEN (rating_use_again+rating_cared_for+rating_rights+rating_outcome)/4.0 END) AS average,AVG(rating_use_again) AS rating_use_again,AVG(rating_cared_for) AS rating_cared_for,AVG(rating_rights) AS rating_rights,AVG(rating_outcome) AS rating_outcome FROM client_verifications WHERE "+where).bind(bar).first()
  ]);
  return json({reviews:rows.results,summary});
 }catch{return fail('Client reviews are temporarily unavailable.',503);}
}
export async function POST(request:Request){
 try{
  const platform=(await profileIdentity(request)),client=await clientIdentity(request);
  const admin=platform.admin;
  let user=client?.user||'',email=client?.email||'';
  if(!sameOrigin(request))return fail('Invalid request origin.',403);
  const text=await request.text();if(text.length>20000)return fail('Request is too large.',413);
  let d:Record<string,unknown>;try{d=JSON.parse(text);}catch{return fail('Invalid request.');}
  if(!d||typeof d!=='object'||Array.isArray(d))return fail('Invalid request.');
  const db=rawDb(),action=str(d.action),now=new Date().toISOString();
  if(action==='review-decide'||action==='admin-list'||action==='decide'||action==='retry-email'||action==='retry-owner-email'||action==='retry-rejection-email'){if(!admin)return fail('Only the site administrator can manage verification requests.',403);user=platform.user;email=platform.email;}
  if(!user||!email)return fail('Log in to your client account to continue.',401);
  if(action==='account'){
   const profile=await db.prepare('SELECT legal_name,first_name,last_name,initial_docket,email,created_at FROM client_profiles WHERE user_id=?').bind(user).first();
   const rows=await db.prepare('SELECT v.id,v.bar_number,a.name AS attorney_name,v.legal_name,v.court,v.county,v.state,v.opposing_party,v.document_name,v.document_date,v.party_role,v.representation_start,v.representation_end,v.request_notes,v.docket,v.status,v.decision_note,v.submitted_at,v.review_body,v.public_mode,v.published_at,v.rating_use_again,v.rating_cared_for,v.rating_rights,v.rating_outcome,v.review_draft,v.review_status,v.review_revision,v.review_decision_note FROM client_verifications v JOIN attorneys a ON a.bar_number=v.bar_number WHERE v.user_id=? ORDER BY v.submitted_at DESC').bind(user).all();
   return json({profile,requests:rows.results,isAdmin:admin,signedInEmail:email});
  }
  if(action==='create-profile'){
   const firstName=str(d.firstName),lastName=str(d.lastName),submittedEmail=str(d.email).toLowerCase();
   if(!firstName||firstName.length>75||!lastName||lastName.length>75||d.consent!==true)return fail('Enter your first name and last name, and agree to private account storage.');
   if(submittedEmail!==email)return fail('Use the email address of your signed-in account. Sign in with that account to use a different email.',403);
   const existing=await db.prepare('SELECT user_id FROM client_profiles WHERE lower(trim(email))=? AND user_id<>?').bind(email,user).first();
   const registered=await db.prepare('SELECT user_id FROM client_account_emails WHERE email=?').bind(email).first<{user_id:string}>();
   if(existing||(registered&&registered.user_id!==user))return fail('A client profile already uses this email. Sign in with the original account.',409);
   const name=firstName+' '+lastName;
   await db.batch([
    db.prepare('INSERT OR IGNORE INTO client_profiles(user_id,legal_name,email,created_at,first_name,last_name,initial_docket) VALUES(?,?,?,?,?,?,?)').bind(user,name,email,now,firstName,lastName,''),
    db.prepare('INSERT INTO client_account_emails(email,user_id) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM client_account_emails WHERE email=? AND user_id=?)').bind(email,user,email,user)
   ]);
   return json({saved:true});
  }
  if(action==='request'||action==='update-request'){
   const bar=str(d.bar),court=str(d.court),county=str(d.county),docket=str(d.docket),state=str(d.state).toUpperCase(),legalName=str(d.legalName),opposingParty=str(d.opposingParty),documentName=str(d.documentName),documentDate=str(d.documentDate),partyRole=str(d.partyRole),representationStart=str(d.representationStart),representationEnd=str(d.representationEnd),requestNotes=str(d.requestNotes);
   if(!validAttorneyId(bar)||court.length>150||county.length>80||docket.length<3||docket.length>100||!normal(docket)||d.attestation!==true)return fail('Enter the attorney and case docket number, and confirm you were this attorney’s client.');
   if(!await allowAuth(request,'verification:'+user))return fail('Too many requests. Please wait 15 minutes and try again.',429);
   if(legalName.length<3||legalName.length>150||legalName.split(/\s+/).length<2||court.length<3||county.length<2||!usStates.includes(state as typeof usStates[number])||!['plaintiff','defendant'].includes(partyRole)||opposingParty.length>200||documentName.length>250||requestNotes.length>2000)return fail('Enter your full legal name, state, county, court, and role in the case.');
   const dateValid=(value:string)=>!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value);
   if(!dateValid(documentDate)||!dateValid(representationStart)||!dateValid(representationEnd)||(representationStart&&representationEnd&&representationEnd<representationStart))return fail('Enter a valid file date and valid representation dates in chronological order.');
   const profile=await db.prepare('SELECT legal_name FROM client_profiles WHERE user_id=?').bind(user).first<{legal_name:string}>();
   if(!profile)return fail('Create your private client profile first.',403);
   if(!await db.prepare('SELECT bar_number FROM attorneys WHERE bar_number=?').bind(bar).first())return fail('Attorney not found.',404);
   const id=JSON.stringify([user,bar]),key=JSON.stringify([state,normal(county),normal(court),normal(docket),normal(legalName),bar]),notificationId=crypto.randomUUID(),recipient=verificationRequestRecipient();
   if(action==='update-request'&&!await db.prepare("SELECT id FROM client_verifications WHERE id=? AND user_id=? AND status='pending'").bind(id,user).first())return fail('Only your own pending request can be updated.',409);
   const statements=[
    db.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,state,opposing_party,document_name,document_date,party_role,representation_start,representation_end,request_notes,docket,relationship_key,status,submitted_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?) ON CONFLICT(id) DO UPDATE SET legal_name=excluded.legal_name,court=excluded.court,county=excluded.county,state=excluded.state,opposing_party=excluded.opposing_party,document_name=excluded.document_name,document_date=excluded.document_date,party_role=excluded.party_role,representation_start=excluded.representation_start,representation_end=excluded.representation_end,request_notes=excluded.request_notes,docket=excluded.docket,relationship_key=excluded.relationship_key,status='pending',submitted_at=excluded.submitted_at,updated_at=excluded.updated_at,decision_note='',reviewed_at=NULL,reviewed_by=NULL,source_url='',identity_evidence='',representation_evidence='' WHERE client_verifications.status=CASE WHEN ?='update-request' THEN 'pending' ELSE 'rejected' END").bind(id,user,bar,legalName,court,county,state,opposingParty,documentName,documentDate,partyRole,representationStart,representationEnd,requestNotes,docket,key,now,now,action),
    db.prepare("INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) SELECT ?,id,?,?,?,? FROM client_verifications WHERE id=? AND status='pending' AND submitted_at=?").bind(crypto.randomUUID(),user,action==='update-request'?'updated':'submitted',action==='update-request'?'Client updated case details for manual review.':'Client requested relationship verification.',now,id,now)
   ];
   if(action==='update-request')statements.push(db.prepare("UPDATE client_verification_request_emails SET status='superseded' WHERE verification_id=? AND status='pending' AND EXISTS(SELECT 1 FROM client_verifications v WHERE v.id=? AND v.submitted_at=? AND v.status='pending')").bind(id,id,now));
   if(recipient)statements.push(db.prepare("INSERT INTO client_verification_request_emails(id,verification_id,recipient,status,created_at) SELECT ?,id,?,'pending',? FROM client_verifications WHERE id=? AND status='pending' AND submitted_at=?").bind(notificationId,recipient,now,id,now));
   const results=await db.batch(statements);
   if(!results[0].meta.changes)return fail('This attorney already has a pending, approved, or revoked request on your account.',409);
   const notificationEmailStatus=recipient?await sendVerificationRequestEmail(notificationId):'not-configured';
   return json({saved:true,status:'pending',notificationEmailStatus});
  }
  if(action==='publish'){
   const body=str(d.body),mode=str(d.mode),id=str(d.id);
   if(body.length<10||body.length>2000||!['named','anonymous'].includes(mode)||d.consent!==true)return fail('Write 10–2,000 characters, choose your public name setting, and confirm publication.');
   const ratings=reviewRatingCategories.map(({key})=>d[key]);
   if(ratings.some(value=>typeof value!=='number'||!Number.isInteger(value)||value<1||value>5))return fail('Choose 1–5 stars for every rating category.');
   const verified=await db.prepare("SELECT id,published_at FROM client_verifications WHERE id=? AND user_id=? AND status='approved'").bind(id,user).first<{id:string;published_at:string|null}>();
   if(!verified)return fail('Only the approved client can submit a review for this attorney.',403);
   if(!verified.published_at){
    const publication=crypto.randomUUID();
    const results=await db.batch([db.prepare("UPDATE client_verifications SET review_body=?,public_mode=?,rating_use_again=?,rating_cared_for=?,rating_rights=?,rating_outcome=?,published_at=?,review_status='published',review_draft='',review_revision=?,review_decision_note='',updated_at=? WHERE id=? AND user_id=? AND status='approved' AND published_at IS NULL").bind(body,mode,...ratings,now,publication,now,id,user),db.prepare("INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) SELECT ?,id,?,'review-published',?,? FROM client_verifications WHERE id=? AND review_revision=? AND published_at=?").bind(crypto.randomUUID(),user,'Verified client published their first review.',now,id,publication,now)]);
    if(!results[0].meta.changes)return fail('The review changed. Refresh your account and try again.',409);
    return json({saved:true,status:'published'});
   }
   const revision=crypto.randomUUID(),draft=JSON.stringify({body,mode,...Object.fromEntries(reviewRatingCategories.map(({key},i)=>[key,ratings[i]]))});
   const recipient=moderationRecipient(),mailId='review-submission:'+revision;
   const attorney=await db.prepare('SELECT a.name FROM attorneys a JOIN client_verifications v ON v.bar_number=a.bar_number WHERE v.id=? AND v.user_id=?').bind(id,user).first<{name:string}>();
   const payload=moderationPayload(recipient,'LawVetter review awaiting approval: '+(attorney?.name||'Attorney'),'A verified client submitted an edit to a published review. The public review stays unchanged until you approve this submission.\n\nAttorney: '+(attorney?.name||'')+'\nAttribution: '+mode+'\nReview: '+body+'\nRatings: '+ratings.join(', ')+'\n\nOpen the signed-in administrator queue to accept or reject: '+adminUrl(id));
   const statements=[db.prepare("UPDATE client_verifications SET review_draft=?,review_status='pending',review_revision=?,review_submitted_at=?,review_decision_note='',updated_at=? WHERE id=? AND user_id=? AND status='approved' AND review_status<>'pending'").bind(draft,revision,now,now,id,user),db.prepare("INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) SELECT ?,id,?,'review-submitted',?,? FROM client_verifications WHERE id=? AND review_revision=?").bind(crypto.randomUUID(),user,revision,now,id,revision)];
   if(recipient)statements.push(db.prepare("INSERT INTO review_moderation_emails(id,verification_id,recipient,payload,created_at) SELECT ?,id,?,?,? FROM client_verifications WHERE id=? AND review_revision=?").bind(mailId,recipient,payload,now,id,revision));
   const results=await db.batch(statements);
   if(!results[0].meta.changes)return fail('Only the approved client can submit a review. A pending submission must be decided before another edit.',409);
   const notificationEmailStatus=recipient?await sendModerationEmail(mailId):'not-configured';
   return json({saved:true,status:'pending',notificationEmailStatus});
  }
  if(action==='withdraw')return fail('Published reviews cannot be deleted by clients. Edits require administrator approval.',403);
  if(action==='review-decide'){
   const id=str(d.id),revision=str(d.revision),decision=str(d.decision),note=str(d.note);
   if(!['approve','reject'].includes(decision)||note.length>1000||(decision==='reject'&&note.length<5))return fail('Choose a decision and provide a reason for rejection.');
   const row=await db.prepare("SELECT v.*,p.email,a.name AS attorney_name FROM client_verifications v JOIN client_profiles p ON p.user_id=v.user_id JOIN attorneys a ON a.bar_number=v.bar_number WHERE v.id=? AND v.status='approved' AND v.review_status='pending' AND v.review_revision=?").bind(id,revision).first<Record<string,string>>();
   if(!row)return fail('This review submission is no longer awaiting approval.',409);
   const draft=JSON.parse(row.review_draft),ratings=reviewRatingCategories.map(({key})=>draft[key]);
   if(typeof draft.body!=='string'||draft.body.trim().length<10||draft.body.length>2000||!['named','anonymous'].includes(draft.mode)||ratings.some(value=>!Number.isInteger(value)||value<1||value>5))return fail('The submitted review is invalid. Reject it and request a correction.');
   const mailId='review-decision:'+revision;
   const payload=moderationPayload(row.email,decision==='approve'?'Your LawVetter review is published':'Update on your LawVetter review',decision==='approve'?'Your review of '+row.attorney_name+' has been approved and is now public.\n\n'+accountUrl(id):'Your review submission for '+row.attorney_name+' was not approved. Your previously published review, if any, is unchanged.\n\nAdministrator note: '+note+'\n\n'+accountUrl(id));
   const update=decision==='approve'?db.prepare("UPDATE client_verifications SET review_body=?,public_mode=?,rating_use_again=?,rating_cared_for=?,rating_rights=?,rating_outcome=?,published_at=COALESCE(published_at,?),review_status='approved',review_decision_note=?,updated_at=? WHERE id=? AND status='approved' AND review_status='pending' AND review_revision=?").bind(draft.body,draft.mode,...ratings,now,note,now,id,revision):db.prepare("UPDATE client_verifications SET review_status='rejected',review_decision_note=?,updated_at=? WHERE id=? AND status='approved' AND review_status='pending' AND review_revision=?").bind(note,now,id,revision);
   const results=await db.batch([update,db.prepare('INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) SELECT ?,id,?,?,?,? FROM client_verifications WHERE id=? AND review_revision=? AND review_status=? AND updated_at=?').bind(crypto.randomUUID(),user,'review-'+(decision==='approve'?'approved':'rejected'),JSON.stringify({revision,note}),now,id,revision,decision==='approve'?'approved':'rejected',now),db.prepare('INSERT OR IGNORE INTO review_moderation_emails(id,verification_id,recipient,payload,created_at) SELECT ?,id,?,?,? FROM client_verifications WHERE id=? AND review_revision=? AND updated_at=?').bind(mailId,row.email,payload,now,id,revision,now)]);
   if(!results[0].meta.changes)return fail('This submission has already been decided.',409);
   return json({saved:true,emailStatus:await sendModerationEmail(mailId)});
  }
  if(action==='retry-rejection-email')return json({emailStatus:await sendRejectionEmail(str(d.id))});
  if(action==='retry-email')return json({emailStatus:await sendApprovalEmail(str(d.id))});
  if(action==='retry-owner-email')return json({emailStatus:await sendLatestVerificationRequestEmail(str(d.id))});
  if(action==='admin-list'){
   if(!admin)return fail('Only the site owner can access client verification records.',403);
   // Recover pending alerts after email configuration is repaired, including older requests without a queue row.
   if(verificationRequestEmailConfigured()){
    const pending=await db.prepare("SELECT v.id FROM client_verifications v WHERE v.status='pending' AND COALESCE((SELECT n.status FROM client_verification_request_emails n WHERE n.verification_id=v.id ORDER BY n.created_at DESC,n.rowid DESC LIMIT 1),'')<>'accepted' ORDER BY v.submitted_at LIMIT 10").all<{id:string}>();
    await Promise.all(pending.results.map(row=>sendLatestVerificationRequestEmail(row.id)));
   }
   const unsent=await db.prepare("SELECT id FROM review_moderation_emails WHERE status='pending' ORDER BY created_at LIMIT 10").all<{id:string}>();
   await Promise.all(unsent.results.map(row=>sendModerationEmail(row.id)));
   const rows=await db.prepare("SELECT v.*,p.email,a.name AS attorney_name,(SELECT status FROM client_approval_emails e WHERE e.verification_id=v.id) AS email_status,(SELECT status FROM client_rejection_emails e WHERE e.verification_id=v.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS rejection_email_status,(SELECT status FROM client_verification_request_emails n WHERE n.verification_id=v.id ORDER BY n.created_at DESC,n.rowid DESC LIMIT 1) AS notification_email_status FROM client_verifications v JOIN client_profiles p ON p.user_id=v.user_id JOIN attorneys a ON a.bar_number=v.bar_number ORDER BY CASE WHEN v.review_status='pending' OR v.status='pending' THEN 0 ELSE 1 END,v.submitted_at DESC LIMIT 200").all();
   return json({requests:rows.results,emailConfigured:emailConfigured(),ownerNotificationConfigured:verificationRequestEmailConfigured()});
  }
  if(action==='decide'){
   if(!admin)return fail('Only the site owner can verify clients.',403);
   const id=str(d.id),decision=str(d.decision),note=str(d.note),source=str(d.source),identity=str(d.identityEvidence),representation=str(d.representationEvidence);
   if(!['approve','reject','revoke'].includes(decision)||note.length<5||note.length>1000)return fail('Select a decision and enter a short note for the client.');
   const record=await db.prepare('SELECT court,county,state,docket,legal_name,bar_number,relationship_key FROM client_verifications WHERE id=?').bind(id).first<{court:string;county:string;state:string;docket:string;legal_name:string;bar_number:string;relationship_key:string}>();
   if(!record)return fail('Verification request not found.',404);
   const court=decision==='approve'?str(d.court):record.court,county=decision==='approve'?str(d.county):record.county;
   const key=decision==='approve'?JSON.stringify([record.state||'GA',normal(county),normal(court),normal(record.docket),normal(record.legal_name),record.bar_number]):record.relationship_key;
   if(decision==='approve'){
    if(court.length<3||court.length>150||county.length<3||county.length>80||!normal(court)||!normal(county))return fail('Resolve the correct county and court from the case record before approval.');
    let validSource=false;try{const u=new URL(source);validSource=u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password&&!u.pathname.startsWith('/auth/');}catch{}
    if(!validSource||identity.length>2000||representation.length>2000||d.identityChecked!==true||d.relationshipChecked!==true||d.recordChecked!==true)return fail('Match the submitted client name, check the court record and attorney–client relationship, and provide an official court record URL (not a login URL).');
   }
   const status=decision==='approve'?'approved':decision==='reject'?'rejected':'revoked';
   const previous=decision==='revoke'?'approved':'pending';
   const rejectionId='reject:'+JSON.stringify([id,now]);
   const results=await db.batch([
    db.prepare("UPDATE client_verifications SET court=?,county=?,relationship_key=?,status=?,decision_note=?,source_url=?,identity_evidence=?,representation_evidence=?,reviewed_at=?,reviewed_by=?,updated_at=? WHERE id=? AND status=? AND (?<>'approved' OR NOT EXISTS(SELECT 1 FROM client_verifications other WHERE other.relationship_key=? AND other.id<>client_verifications.id AND other.status='approved'))").bind(court,county,key,status,note,source,identity,representation,now,user,now,id,previous,status,key),
    db.prepare('INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) SELECT ?,id,?,?,?,? FROM client_verifications WHERE id=? AND reviewed_at=? AND reviewed_by=? AND status=?').bind(crypto.randomUUID(),user,status,JSON.stringify({note,source,identity,representation,identityChecked:d.identityChecked===true,recordChecked:d.recordChecked===true,relationshipChecked:d.relationshipChecked===true}),now,id,now,user,status),
    db.prepare("INSERT OR IGNORE INTO client_approval_emails(verification_id,id,recipient,status) SELECT v.id,?,p.email,'pending' FROM client_verifications v JOIN client_profiles p ON p.user_id=v.user_id WHERE v.id=? AND v.status='approved' AND v.reviewed_at=? AND v.reviewed_by=?").bind(crypto.randomUUID(),id,now,user),
    db.prepare("INSERT OR IGNORE INTO client_rejection_emails(id,verification_id,recipient,status,created_at) SELECT ?,v.id,p.email,'pending',? FROM client_verifications v JOIN client_profiles p ON p.user_id=v.user_id WHERE v.id=? AND v.status='rejected' AND v.reviewed_at=? AND v.reviewed_by=?").bind(rejectionId,now,id,now,user)
   ]);
   if(!results[0].meta.changes)return fail('Cannot reuse an approved relationship or change a request that is no longer in the expected state.',409);
   const emailStatus=decision==='approve'?await sendApprovalEmail(id):decision==='reject'?await sendRejectionEmail(id):null;
   return json({saved:true,emailStatus});
  }
  return fail('Unknown action.');
 }catch{return fail('Client review services are temporarily unavailable. Please try again.',503);}
}
