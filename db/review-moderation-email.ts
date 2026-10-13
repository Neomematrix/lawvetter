import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {escapeHtml} from './mail-markup';
const config=()=>env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string;CLAIM_ADMIN_EMAIL?:string};
export function moderationRecipient(){return (config().CLAIM_ADMIN_EMAIL||'').trim().toLowerCase();}
export function moderationPayload(recipient:string,subject:string,text:string){return JSON.stringify({from:config().APPROVAL_EMAIL_FROM||'LawVetter <no-reply@lawvetter.com>',to:[recipient],subject,text,html:'<p>'+escapeHtml(text).replace(/\n/g,'<br>')+'</p>'});}
export async function sendModerationEmail(id:string){
 const db=rawDb(),row=await db.prepare('SELECT * FROM review_moderation_emails WHERE id=?').bind(id).first<{status:string;payload:string;first_attempt:number|null}>();
 if(!row)return 'not-queued';if(row.status==='accepted')return 'accepted';const c=config();if(!c.RESEND_API_KEY||!c.APPROVAL_EMAIL_FROM)return 'not-configured';if(row.first_attempt&&Date.now()-row.first_attempt>23*3600000)return 'check-provider';
 await db.prepare('UPDATE review_moderation_emails SET first_attempt=COALESCE(first_attempt,?) WHERE id=?').bind(Date.now(),id).run();
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:row.payload,signal:AbortSignal.timeout(10000)});if(!r.ok)return 'pending';const d=await r.json() as {id?:string};if(!d.id)return 'pending';await db.prepare("UPDATE review_moderation_emails SET status='accepted',provider_id=? WHERE id=?").bind(d.id,id).run();return 'accepted';}catch{return 'pending';}
}
