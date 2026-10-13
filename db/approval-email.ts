import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {escapeHtml,accountUrl,mailButton} from './mail-markup';
const config=()=>env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};
export function emailConfigured(){const c=config();return !!c.RESEND_API_KEY&&!!c.APPROVAL_EMAIL_FROM;}
export async function sendApprovalEmail(id:string){
 const db=rawDb();const row=await db.prepare("SELECT e.*,v.legal_name,v.id AS request_id,a.name AS attorney_name FROM client_approval_emails e JOIN client_verifications v ON v.id=e.verification_id JOIN attorneys a ON a.bar_number=v.bar_number WHERE e.verification_id=? AND v.status='approved'").bind(id).first<{id:string;recipient:string;status:string;payload:string;first_attempt:number|null;legal_name:string;request_id:string;attorney_name:string}>();
 if(!row)return 'not-queued';if(row.status==='accepted')return 'accepted';if(!emailConfigured())return 'not-configured';
 // Never retry an uncertain send beyond the provider's 24-hour deduplication window.
 if(row.first_attempt&&Date.now()-row.first_attempt>23*3600000)return 'check-provider';
 const c=config(),url=accountUrl(row.request_id),text='Congratulations, '+row.legal_name+'! Your request to review '+row.attorney_name+' has been approved. This attorney is now in your My attorneys roster. Log in to leave a review, with your name or anonymously.\n\n'+url+'\n\nNo review is published until you submit it.';
 const payload=row.payload||JSON.stringify({from:c.APPROVAL_EMAIL_FROM,to:[row.recipient],subject:'Congratulations! You can now review '+row.attorney_name,text,html:'<h1>You can now review your attorney</h1><p>'+escapeHtml(text).replace(/\n/g,'<br>')+'</p>'+mailButton('Review your attorney',url)});
 await db.prepare("UPDATE client_approval_emails SET payload=CASE WHEN payload='' THEN ? ELSE payload END,first_attempt=COALESCE(first_attempt,?),status='pending' WHERE verification_id=? AND status<>'accepted'").bind(payload,Date.now(),id).run();
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:payload,signal:AbortSignal.timeout(10000)});if(!response.ok)return 'pending';const result=await response.json() as {id?:string};if(!result.id)return 'pending';await db.prepare("UPDATE client_approval_emails SET status='accepted',provider_id=? WHERE verification_id=?").bind(result.id,id).run();return 'accepted';}catch{return 'pending';}
}

export async function sendRejectionEmail(id:string){
 const db=rawDb();const row=await db.prepare("SELECT e.*,v.legal_name,v.decision_note,v.id AS request_id,a.name AS attorney_name FROM client_rejection_emails e JOIN client_verifications v ON v.id=e.verification_id JOIN attorneys a ON a.bar_number=v.bar_number WHERE e.verification_id=? AND v.status='rejected' ORDER BY e.created_at DESC,e.id DESC LIMIT 1").bind(id).first<{id:string;recipient:string;status:string;payload:string;first_attempt:number|null;legal_name:string;decision_note:string;request_id:string;attorney_name:string}>();
 if(!row)return 'not-queued';if(row.status==='accepted')return 'accepted';if(!emailConfigured())return 'not-configured';if(row.first_attempt&&Date.now()-row.first_attempt>23*3600000)return 'check-provider';
 const c=config(),url=accountUrl(row.request_id),text='Your request to review '+row.attorney_name+' was not approved.\n\nAdministrator note: '+row.decision_note+'\n\nYou may sign in and submit corrected case details.\n\n'+url;
 const payload=row.payload||JSON.stringify({from:c.APPROVAL_EMAIL_FROM,to:[row.recipient],subject:'Update on your LawVetter attorney review request',text,html:'<h1>Update on your review request</h1><p>'+escapeHtml(text).replace(/\n/g,'<br>')+'</p>'+mailButton('View request',url)});
 await db.prepare("UPDATE client_rejection_emails SET payload=CASE WHEN payload='' THEN ? ELSE payload END,first_attempt=COALESCE(first_attempt,?) WHERE id=? AND status<>'accepted'").bind(payload,Date.now(),row.id).run();
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:payload,signal:AbortSignal.timeout(10000)});if(!response.ok)return 'pending';const result=await response.json() as {id?:string};if(!result.id)return 'pending';await db.prepare("UPDATE client_rejection_emails SET status='accepted',provider_id=? WHERE id=?").bind(result.id,row.id).run();return 'accepted';}catch{return 'pending';}
}
