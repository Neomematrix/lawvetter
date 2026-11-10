import {rawDb} from './raw';
import {digest} from './client-auth';
import {env} from 'cloudflare:workers';
export async function sendEmailChange(to:string,token:string){
 const key=(env as unknown as {RESEND_API_KEY?:string}).RESEND_API_KEY;if(!key)return false;
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'email-change-'+digest(token)},body:JSON.stringify({from:'LawVetter <no-reply@lawvetter.com>',to:[to],subject:'Confirm your new LawVetter login email',text:'Confirm your new login email using the link below within 30 minutes. Sign in to the same LawVetter account with your current email if asked. Your login email stays unchanged until you confirm.\n\nhttps://www.lawvetter.com/account/change-email#token='+token+'\n\nIf you did not request this, ignore this email.'}),signal:AbortSignal.timeout(10000)});return r.ok&&!!(await r.json() as {id?:string}).id;}catch{return false;}
}
export async function confirmEmailChange(user:string,token:string){
 const db=rawDb(),hash=digest(token),now=Date.now();
 const pending=await db.prepare('SELECT new_email FROM client_email_changes e WHERE user_id=? AND token_hash=? AND expires_at>? AND EXISTS(SELECT 1 FROM client_profiles p JOIN client_passwords c ON c.user_id=p.user_id WHERE p.user_id=e.user_id AND lower(trim(p.email))=e.old_email AND c.password_hash=e.password_hash)').bind(user,hash,now).first<{new_email:string}>();
 if(!pending)return false;
 const valid="EXISTS(SELECT 1 FROM client_email_changes e JOIN client_profiles p ON p.user_id=e.user_id JOIN client_passwords c ON c.user_id=e.user_id WHERE e.user_id=? AND e.token_hash=? AND e.expires_at>? AND lower(trim(p.email))=e.old_email AND c.password_hash=e.password_hash)";
 const changed="EXISTS(SELECT 1 FROM client_email_changes e JOIN client_account_emails a ON a.user_id=e.user_id WHERE e.user_id=? AND e.token_hash=? AND a.email=e.new_email)";
 const result=await db.batch([
 db.prepare('UPDATE client_account_emails SET email=? WHERE user_id=? AND '+valid+' AND NOT EXISTS(SELECT 1 FROM client_profiles WHERE lower(trim(email))=? AND user_id<>?)').bind(pending.new_email,user,user,hash,now,pending.new_email,user),
 db.prepare('UPDATE client_profiles SET email=? WHERE user_id=? AND '+changed).bind(pending.new_email,user,user,hash),
 db.prepare('DELETE FROM account_email_confirmations WHERE user_id=? AND '+changed).bind(user,user,hash),
 db.prepare('DELETE FROM client_password_reset_tokens WHERE user_id=? AND '+changed).bind(user,user,hash),
 db.prepare('DELETE FROM client_sessions WHERE user_id=? AND '+changed).bind(user,user,hash),
 db.prepare('DELETE FROM client_email_changes WHERE user_id=? AND token_hash=?').bind(user,hash)
 ]);
 return !!result[0].meta.changes;
}
