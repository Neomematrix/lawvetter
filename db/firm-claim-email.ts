import {env} from 'cloudflare:workers';
import {randomBytes,createHash} from 'node:crypto';
import {rawDb} from './raw';
import {escapeHtml,mailButton} from './mail-markup';
import {siteOrigin} from './site-settings';
export const firmClaimHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function sendFirmClaimConfirmation(id:string){
 const db=rawDb(),claim=await db.prepare("SELECT firm_email,firm_name,firm_email_verified_at,email_sent_at FROM firm_claims WHERE id=? AND status='pending'").bind(id).first<{firm_email:string;firm_name:string;firm_email_verified_at:string|null;email_sent_at:number}>();
 if(!claim)return 'unavailable';if(claim.firm_email_verified_at)return 'confirmed';
 const config=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};if(!config.RESEND_API_KEY)return 'unavailable';
 const now=Date.now();if(claim.email_sent_at>now-60000)return 'rate-limited';
 const token=randomBytes(32).toString('hex'),hash=firmClaimHash(token),result=await db.prepare("UPDATE firm_claims SET email_token_hash=?,email_token_expires=?,email_sent_at=? WHERE id=? AND status='pending' AND firm_email_verified_at IS NULL AND email_sent_at=?").bind(hash,0,now,id,claim.email_sent_at).run();if(!result.meta.changes)return 'rate-limited';
 const url=(await siteOrigin())+'/firm-access/verify?token='+token,intro='Confirm this firm email for your request to manage '+claim.firm_name+'. This link has no time limit and can be used once. Requesting another email replaces this link. Confirming an email on the recorded firm domain automatically activates management access for your requesting LawVetter account, provided the firm has no existing manager. Other requests require administrator review.';
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'firm-confirm/'+hash},body:JSON.stringify({from:config.APPROVAL_EMAIL_FROM||'LawVetter <no-reply@lawvetter.com>',to:[claim.firm_email],subject:'Confirm your firm email for LawVetter',text:intro+'\n\n'+url,html:'<h1>Confirm your firm email</h1><p>'+escapeHtml(intro)+'</p>'+mailButton('Confirm firm email',url)}),signal:AbortSignal.timeout(12000)});const data=await response.json() as {id?:string};if(response.ok&&data.id)return 'accepted';}catch{}
 await db.prepare("UPDATE firm_claims SET email_sent_at=0,email_token_hash='',email_token_expires=0 WHERE id=? AND email_token_hash=? AND status='pending'").bind(id,hash).run();return 'unavailable';
}
