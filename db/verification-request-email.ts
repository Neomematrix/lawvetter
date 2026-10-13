import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {escapeHtml,adminUrl,mailButton} from './mail-markup';

const config=()=>env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string;CLAIM_ADMIN_EMAIL?:string};

export function verificationRequestRecipient(){return (config().CLAIM_ADMIN_EMAIL||'').trim().toLowerCase();}
export function verificationRequestEmailConfigured(){const c=config();return !!c.RESEND_API_KEY&&!!c.APPROVAL_EMAIL_FROM&&!!verificationRequestRecipient();}

export async function sendVerificationRequestEmail(notificationId:string){
 const db=rawDb();const row=await db.prepare('SELECT * FROM client_verification_request_emails WHERE id=?').bind(notificationId).first<{id:string;recipient:string;status:string;payload:string;first_attempt:number|null}>();
 if(!row||row.status==='superseded')return 'not-queued';if(row.status==='accepted')return 'accepted';if(!verificationRequestEmailConfigured())return 'not-configured';
 // Resend deduplicates idempotency keys for 24 hours. Do not create a possible duplicate after that window.
 if(row.first_attempt&&Date.now()-row.first_attempt>23*3600000)return 'check-provider';
 const c=config();
 const details=await db.prepare("SELECT v.*,p.email,p.legal_name AS account_name,a.name AS attorney_name,a.company AS firm_name FROM client_verifications v JOIN client_profiles p ON p.user_id=v.user_id JOIN attorneys a ON a.bar_number=v.bar_number WHERE v.id=(SELECT verification_id FROM client_verification_request_emails WHERE id=?) AND v.status='pending'").bind(notificationId).first<Record<string,string>>();
 if(!details)return 'not-queued';
 const fields:[string,string][]=[['Client full name',details.legal_name],['Account profile name',details.account_name],['Account email',details.email],['Attorney',details.attorney_name],['Attorney bar number',details.bar_number],['Law firm',details.firm_name||'Not listed'],['Docket / case number',details.docket],['State',details.state||'GA'],['County',details.county||'Not supplied (older request)'],['Court',details.court||'Not supplied (older request)'],['Other party’s full name',details.opposing_party||'Not supplied'],['File date',details.document_date||'Not supplied'],['Client party role',details.party_role||'Not supplied'],['Representation dates',[details.representation_start,details.representation_end].filter(Boolean).join(' to ')||'Not supplied'],['Client notes',details.request_notes||'None'],['Submitted',details.submitted_at]];
 const url=adminUrl(details.id),text='A client is requesting permission to review this attorney. Manually check the case, named party, and attorney representation before deciding.\n\n'+fields.map(([k,v])=>k+': '+v).join('\n')+'\n\nReview request: '+url+'\n\nAccept or reject securely after signing in. Email links do not make a decision automatically.';
 const html='<h1>New LawVetter review request</h1><p>Manually check the court record and attorney–client relationship before deciding.</p><dl>'+fields.map(([k,v])=>'<dt><strong>'+escapeHtml(k)+'</strong></dt><dd style="margin:0 0 12px;white-space:pre-wrap">'+escapeHtml(v)+'</dd>').join('')+'</dl>'+mailButton('Accept request',adminUrl(details.id,'approve'))+mailButton('Reject request',adminUrl(details.id,'reject'))+'<p>These buttons open the signed-in review screen. They do not automatically approve or reject a request.</p>';
 const payload=row.payload||JSON.stringify({from:c.APPROVAL_EMAIL_FROM,to:[row.recipient],subject:'LawVetter review request: '+details.attorney_name,text,html});
 await db.prepare("UPDATE client_verification_request_emails SET payload=CASE WHEN payload='' THEN ? ELSE payload END,first_attempt=COALESCE(first_attempt,?),status='pending' WHERE id=? AND status<>'accepted'").bind(payload,Date.now(),notificationId).run();
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:payload,signal:AbortSignal.timeout(10000)});if(!response.ok)return 'pending';const result=await response.json() as {id?:string};if(!result.id)return 'pending';await db.prepare("UPDATE client_verification_request_emails SET status='accepted',provider_id=? WHERE id=?").bind(result.id,notificationId).run();return 'accepted';}catch{return 'pending';}
}

export async function sendLatestVerificationRequestEmail(verificationId:string){
 const db=rawDb();let row=await db.prepare('SELECT id FROM client_verification_request_emails WHERE verification_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(verificationId).first<{id:string}>();
 if(!row){const recipient=verificationRequestRecipient();if(!recipient)return 'not-configured';const id=crypto.randomUUID(),createdAt=new Date().toISOString();const result=await db.prepare("INSERT INTO client_verification_request_emails(id,verification_id,recipient,status,created_at) SELECT ?,id,?,'pending',? FROM client_verifications WHERE id=? AND status='pending'").bind(id,recipient,createdAt,verificationId).run();if(!result.meta.changes)return 'not-queued';row={id};}
 return sendVerificationRequestEmail(row.id);
}
