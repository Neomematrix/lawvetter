import {inquiryEmail} from './inquiry-email';
import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
export const inquirySender='LawVetter <no-reply@lawvetter.com>';
type Reply={id:string;lead_id:string;recipient:string;subject:string;body:string;status:string;provider_id:string;created_at:string;first_attempt:number|null;lease:number};
export async function ensureLeadReplies(){const db=rawDb();await db.prepare(`CREATE TABLE IF NOT EXISTS lead_replies (id TEXT PRIMARY KEY,lead_id TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',provider_id TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,created_by TEXT NOT NULL,first_attempt INTEGER,lease INTEGER NOT NULL DEFAULT 0)`).run();await db.prepare('CREATE INDEX IF NOT EXISTS lead_replies_lead ON lead_replies(lead_id,created_at)').run();}
export async function listLeadReplies(id:string){await ensureLeadReplies();return (await rawDb().prepare('SELECT id,recipient,subject,body,status,created_at FROM lead_replies WHERE lead_id=? ORDER BY created_at,id').bind(id).all()).results;}
export async function sendLeadReply(leadId:string,id:string,subject:string,body:string,user:string){
 await ensureLeadReplies();const db=rawDb(),c=env as unknown as {RESEND_API_KEY?:string};
 if(!c.RESEND_API_KEY)throw Error('The email service is not configured. Your draft has not been sent.');
 const lead=await db.prepare('SELECT email FROM client_leads WHERE id=?').bind(leadId).first<{email:string}>();if(!lead)throw Error('Inquiry not found.');
 // The recipient is always resolved from the saved inquiry, never from the browser.
 await db.prepare('INSERT INTO lead_replies(id,lead_id,recipient,subject,body,created_at,created_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,leadId,lead.email,subject,body,new Date().toISOString(),user).run();
 const row=await db.prepare('SELECT * FROM lead_replies WHERE id=?').bind(id).first<Reply>();
 if(!row||row.lead_id!==leadId||row.subject!==subject||row.body!==body)throw Error('This send attempt belongs to a different draft. Refresh the inbox before sending.');
 if(row.provider_id)return 'accepted';
 const now=Date.now();if(row.first_attempt&&now-row.first_attempt>23*3600000)throw Error('This send attempt is too old to retry safely. Check the email provider before sending again.');
 const lease=await db.prepare("UPDATE lead_replies SET first_attempt=COALESCE(first_attempt,?),lease=? WHERE id=? AND provider_id='' AND lease<=?").bind(now,now+30000,id,now).run();if(!lease.meta.changes)return 'pending';
 let providerId='';try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'inquiry-reply/'+id},body:JSON.stringify({from:inquirySender,to:[row.recipient],subject:row.subject,...inquiryEmail({title:row.subject,message:row.body,button:'Contact LawVetter',url:'https://lawvetter.com/contact',note:'Please use our contact page for follow-up. This email was sent from no-reply@lawvetter.com.'})}),signal:AbortSignal.timeout(10000)});const result=await response.json() as {id?:string};if(response.ok&&result.id)providerId=result.id;}catch{}
 await db.prepare('UPDATE lead_replies SET status=?,provider_id=?,lease=0 WHERE id=? AND provider_id=\'\'').bind(providerId?'accepted':'pending',providerId,id).run();
 return providerId?'accepted':'pending';
}
