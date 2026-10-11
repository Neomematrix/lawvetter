import {env} from 'cloudflare:workers';
import {rawDb} from './raw';

const config=()=>env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string;CLAIM_ADMIN_EMAIL?:string};

export function verificationRequestRecipient(){return (config().CLAIM_ADMIN_EMAIL||'').trim().toLowerCase();}
export function verificationRequestEmailConfigured(){const c=config();return !!c.RESEND_API_KEY&&!!c.APPROVAL_EMAIL_FROM&&!!verificationRequestRecipient();}

export async function sendVerificationRequestEmail(notificationId:string){
 const db=rawDb();const row=await db.prepare('SELECT * FROM client_verification_request_emails WHERE id=?').bind(notificationId).first<{id:string;recipient:string;status:string;payload:string;first_attempt:number|null}>();
 if(!row)return 'not-queued';if(row.status==='accepted')return 'accepted';if(!verificationRequestEmailConfigured())return 'not-configured';
 // Resend deduplicates idempotency keys for 24 hours. Do not create a possible duplicate after that window.
 if(row.first_attempt&&Date.now()-row.first_attempt>23*3600000)return 'check-provider';
 const c=config();const payload=row.payload||JSON.stringify({from:c.APPROVAL_EMAIL_FROM,to:[row.recipient],subject:'New LawVetter client verification request',text:'A new client verification request is waiting for your manual review. Sign in to the private owner queue to verify the applicant identity, court record, and attorney-client relationship.\n\nhttps://lawvetter-reviews.kyle-george-1801.chatgpt.site/admin/client-reviews\n\nDo not approve a request based on this email alone. No client name, email, docket number, or private evidence is included in this notification.'});
 await db.prepare("UPDATE client_verification_request_emails SET payload=CASE WHEN payload='' THEN ? ELSE payload END,first_attempt=COALESCE(first_attempt,?),status='pending' WHERE id=? AND status<>'accepted'").bind(payload,Date.now(),notificationId).run();
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:payload,signal:AbortSignal.timeout(10000)});if(!response.ok)return 'pending';const result=await response.json() as {id?:string};if(!result.id)return 'pending';await db.prepare("UPDATE client_verification_request_emails SET status='accepted',provider_id=? WHERE id=?").bind(result.id,notificationId).run();return 'accepted';}catch{return 'pending';}
}

export async function sendLatestVerificationRequestEmail(verificationId:string){
 const db=rawDb();let row=await db.prepare('SELECT id FROM client_verification_request_emails WHERE verification_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(verificationId).first<{id:string}>();
 if(!row){const recipient=verificationRequestRecipient();if(!recipient)return 'not-configured';const id=crypto.randomUUID(),createdAt=new Date().toISOString();const result=await db.prepare("INSERT INTO client_verification_request_emails(id,verification_id,recipient,status,created_at) SELECT ?,id,?,'pending',? FROM client_verifications WHERE id=? AND status='pending'").bind(id,recipient,createdAt,verificationId).run();if(!result.meta.changes)return 'not-queued';row={id};}
 return sendVerificationRequestEmail(row.id);
}
