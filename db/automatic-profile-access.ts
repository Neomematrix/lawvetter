import {rawDb} from './raw';
import {env} from 'cloudflare:workers';
import {createHash,randomBytes} from 'node:crypto';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const note='Automatically verified through confirmed account email matching the directory email.';
// Typed email, firm membership, and matching domains never establish ownership.
export async function syncEmailAccess(client:{user:string;email:string}){
 const db=rawDb(),email=client.email.trim().toLowerCase(),now=new Date().toISOString();
 const proof=await db.prepare('SELECT verified_at FROM account_email_confirmations WHERE user_id=? AND email=? AND verified_at IS NOT NULL').bind(client.user,email).first();if(!proof)return;
 const guard="EXISTS(SELECT 1 FROM account_email_confirmations e JOIN client_profiles cp ON cp.user_id=e.user_id WHERE e.user_id=? AND e.email=? AND lower(trim(cp.email))=e.email AND e.verified_at IS NOT NULL)";
 const matches=await db.prepare('SELECT bar_number FROM attorneys WHERE lower(trim(email))=?').bind(email).all<{bar_number:string}>();
 // A shared mailbox or duplicate directory entries require manual review.
 if(matches.results.length===1){const bar=matches.results[0].bar_number;
  await db.batch([
   db.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) SELECT a.bar_number,?,?,? FROM attorneys a WHERE a.bar_number=? AND lower(trim(a.email))=? AND (SELECT COUNT(*) FROM attorneys am WHERE lower(trim(am.email))=lower(trim(a.email)))=1 AND "+guard+" AND NOT EXISTS(SELECT 1 FROM profile_claims c WHERE c.bar_number=a.bar_number AND c.user_id=? AND c.status='rejected') AND NOT EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.owner_id=? AND p.bar_number<>a.bar_number AND p.claimed_at<>'') ON CONFLICT(bar_number) DO UPDATE SET owner_id=excluded.owner_id,claimed_at=excluded.claimed_at,updated_at=excluded.updated_at WHERE attorney_profiles.owner_id=''").bind(client.user,now,now,bar,email,client.user,email,client.user,client.user),
   db.prepare("UPDATE profile_claims SET status='approved',firm_email=?,firm_email_verified_at=?,review_note=?,reviewed_at=?,reviewed_by='email-verification',email_token_hash='',email_token_expires=0 WHERE bar_number=? AND user_id=? AND status='pending' AND EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=profile_claims.bar_number AND p.owner_id=profile_claims.user_id AND p.claimed_at<>'')").bind(email,now,note,now,bar,client.user),
   db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'attorney-email-access',?,? WHERE EXISTS(SELECT 1 FROM attorney_profiles WHERE bar_number=? AND owner_id=? AND claimed_at=?) AND NOT EXISTS(SELECT 1 FROM admin_audit WHERE actor=? AND action='attorney-email-access' AND record_id=?)").bind(crypto.randomUUID(),client.user,bar,now,bar,client.user,now,client.user,bar)
  ]);
 }
 const firms=await db.prepare("SELECT key,name FROM firm_settings WHERE organization_type='Law Firm' AND lower(trim(email))=? AND trim(name)<>''").bind(email).all<{key:string;name:string}>();
 for(const firm of firms.results){const id='email:'+JSON.stringify([client.user,firm.key]);
  await db.batch([
   db.prepare("INSERT INTO firm_claims(id,firm_key,firm_name,user_id,firm_email,authority,status,firm_email_verified_at,review_note,submitted_at,reviewed_at,reviewed_by) SELECT ?,?,?,?,?,?,'approved',?,?,?,?,? WHERE "+guard+" AND EXISTS(SELECT 1 FROM firm_settings WHERE key=? AND lower(trim(email))=?) AND NOT EXISTS(SELECT 1 FROM firm_owners WHERE firm_key=?) AND NOT EXISTS(SELECT 1 FROM firm_claims WHERE user_id=? AND firm_key=? AND status IN ('rejected','revoked')) ON CONFLICT(user_id,firm_key) DO UPDATE SET status='approved',firm_email=excluded.firm_email,firm_email_verified_at=excluded.firm_email_verified_at,review_note=excluded.review_note,reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,email_token_hash='',email_token_expires=0 WHERE firm_claims.status='pending'").bind(id,firm.key,firm.name,client.user,email,note,now,note,now,now,'email-verification',client.user,email,firm.key,email,firm.key,client.user,firm.key),
   db.prepare("INSERT INTO firm_owners(firm_key,user_id,claim_id,approved_at) SELECT firm_key,user_id,id,? FROM firm_claims WHERE firm_key=? AND user_id=? AND status='approved' AND firm_email_verified_at IS NOT NULL AND reviewed_by='email-verification' AND "+guard+" ON CONFLICT(firm_key) DO NOTHING").bind(now,firm.key,client.user,client.user,email),
   db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'firm-email-access',?,? WHERE EXISTS(SELECT 1 FROM firm_owners WHERE firm_key=? AND user_id=? AND approved_at=?) AND NOT EXISTS(SELECT 1 FROM admin_audit WHERE actor=? AND action='firm-email-access' AND record_id=?)").bind(crypto.randomUUID(),client.user,firm.key,now,firm.key,client.user,now,client.user,firm.key)
  ]);
 }
}
export async function emailAccessStatus(client:{user:string;email:string}){
 const db=rawDb(),email=client.email.trim().toLowerCase();
 const row=await db.prepare('SELECT verified_at FROM account_email_confirmations WHERE user_id=? AND email=?').bind(client.user,email).first<{verified_at:string|null}>();
 const match=await db.prepare('SELECT 1 AS matched WHERE EXISTS(SELECT 1 FROM attorneys WHERE lower(trim(email))=?) OR EXISTS(SELECT 1 FROM firm_settings WHERE lower(trim(email))=?)').bind(email,email).first();
 const direct=await db.prepare("SELECT 1 AS approved WHERE EXISTS(SELECT 1 FROM profile_claims c JOIN attorney_profiles p ON p.bar_number=c.bar_number AND p.owner_id=c.user_id WHERE c.user_id=? AND lower(trim(c.email))=? AND c.status='approved' AND c.reviewed_by LIKE 'admin:%') OR EXISTS(SELECT 1 FROM firm_claims c JOIN firm_owners fo ON fo.claim_id=c.id AND fo.user_id=c.user_id WHERE c.user_id=? AND lower(trim(c.firm_email))=? AND c.status='approved' AND c.reviewed_by LIKE 'admin:%')").bind(client.user,email,client.user,email).first();
 return {matched:!!match,verified:!!row?.verified_at||!!direct};
}
export async function sendAccessConfirmation(client:{user:string;email:string},origin:string){
 const status=await emailAccessStatus(client);if(!status.matched||status.verified)return 'unneeded';
 const config=env as unknown as {RESEND_API_KEY?:string};if(!config.RESEND_API_KEY)return 'unavailable';
 const db=rawDb(),now=Date.now(),token=randomBytes(32).toString('hex'),email=client.email.trim().toLowerCase();
 const result=await db.prepare("INSERT INTO account_email_confirmations(user_id,email,token_hash,expires_at,sent_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,verified_at=NULL,token_hash=excluded.token_hash,expires_at=excluded.expires_at,sent_at=excluded.sent_at WHERE (account_email_confirmations.email<>excluded.email OR account_email_confirmations.verified_at IS NULL) AND account_email_confirmations.sent_at<?").bind(client.user,email,hash(token),0,now,now-60000).run();if(!result.meta.changes)return 'rate-limited';
 const url=origin+'/confirm-profile-email?token='+token;
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'profile-access-'+hash(token)},body:JSON.stringify({from:'LawVetter <no-reply@lawvetter.com>',to:[email],subject:'Confirm your email to manage your LawVetter profile',text:'Your account email matches an attorney or firm email on LawVetter. Confirm that you control this email to receive access automatically. This link has no time limit and can be used once. Requesting a new link replaces this one. Sign in to the same account to confirm.\n\n'+url+'\n\nIf you did not request this, ignore this email.'}),signal:AbortSignal.timeout(10000)});if(response.ok&&(await response.json() as {id?:string}).id)return 'sent';}catch{}
 await db.prepare("UPDATE account_email_confirmations SET token_hash='',expires_at=0,sent_at=0 WHERE user_id=? AND token_hash=?").bind(client.user,hash(token)).run();return 'unavailable';
}
export async function confirmAccessEmail(client:{user:string;email:string},token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 const result=await rawDb().prepare("UPDATE account_email_confirmations SET verified_at=?,token_hash='',expires_at=0 WHERE user_id=? AND email=? AND token_hash=? AND verified_at IS NULL AND EXISTS(SELECT 1 FROM client_profiles cp WHERE cp.user_id=account_email_confirmations.user_id AND lower(trim(cp.email))=account_email_confirmations.email)").bind(new Date().toISOString(),client.user,client.email.trim().toLowerCase(),hash(token)).run();
 if(!result.meta.changes)return false;await syncEmailAccess(client);return true;
}
