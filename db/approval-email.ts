import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
const config=()=>env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};
export function emailConfigured(){const c=config();return !!c.RESEND_API_KEY&&!!c.APPROVAL_EMAIL_FROM;}
export async function sendApprovalEmail(id:string){
 const db=rawDb();const row=await db.prepare("SELECT e.* FROM client_approval_emails e JOIN client_verifications v ON v.id=e.verification_id WHERE e.verification_id=? AND v.status='approved'").bind(id).first<{id:string;recipient:string;status:string;payload:string;first_attempt:number|null}>();
 if(!row)return 'not-queued';if(row.status==='accepted')return 'accepted';if(!emailConfigured())return 'not-configured';
 // Never retry an uncertain send beyond the provider's 24-hour deduplication window.
 if(row.first_attempt&&Date.now()-row.first_attempt>23*3600000)return 'check-provider';
 const c=config();const payload=row.payload||JSON.stringify({from:c.APPROVAL_EMAIL_FROM,to:[row.recipient],subject:'Your LawVetter review request is approved',text:'Your client verification request has been approved. You can now log in to LawVetter and leave your review, with your name or anonymously.\n\nhttps://lawvetter.kyle-george-1801.chatgpt.site/client-reviews\n\nNo review is published until you choose to submit it.'});
 await db.prepare("UPDATE client_approval_emails SET payload=CASE WHEN payload='' THEN ? ELSE payload END,first_attempt=COALESCE(first_attempt,?),status='pending' WHERE verification_id=? AND status<>'accepted'").bind(payload,Date.now(),id).run();
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:payload,signal:AbortSignal.timeout(10000)});if(!response.ok)return 'pending';const result=await response.json() as {id?:string};if(!result.id)return 'pending';await db.prepare("UPDATE client_approval_emails SET status='accepted',provider_id=? WHERE verification_id=?").bind(result.id,id).run();return 'accepted';}catch{return 'pending';}
}
