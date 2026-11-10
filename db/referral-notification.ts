import {inquiryEmail} from './inquiry-email';
import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {siteOrigin} from './site-settings';
import {digest} from './client-auth';
export async function notifyAttorney(leadId:string){
 const db=rawDb(),lead=await db.prepare("SELECT l.attorney_bar,a.name AS attorney_name,a.email AS directory_email,COALESCE(p.owner_id,'') AS owner_id,(SELECT c.firm_email FROM profile_claims c WHERE c.bar_number=a.bar_number AND c.user_id=p.owner_id AND p.claimed_at<>'' AND c.status='approved' AND c.firm_email_verified_at IS NOT NULL AND trim(c.firm_email)<>'' ORDER BY c.reviewed_at DESC LIMIT 1) AS verified_email FROM client_leads l JOIN attorneys a ON a.bar_number=l.attorney_bar LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE l.id=?").bind(leadId).first<{attorney_bar:string;attorney_name:string;directory_email:string;owner_id:string;verified_email:string|null}>();
 if(!lead)return 'no-attorney';
 const email=(lead.verified_email||lead.directory_email||'').trim().toLowerCase();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return 'professional-email-needed';
 const config=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};if(!config.RESEND_API_KEY||!config.APPROVAL_EMAIL_FROM)return 'not-configured';
 // Stable recipient-based identity prevents a second alert when the same attorney claims their profile.
 const previous=await db.prepare('SELECT id FROM referral_notifications WHERE lead_id=? AND lower(email)=? ORDER BY first_attempt LIMIT 1').bind(leadId,email).first<{id:string}>();
 const id=previous?.id||digest('referral:'+leadId+':'+email),now=Date.now(),url=await siteOrigin()+'/account?bar='+encodeURIComponent(lead.attorney_bar)+'#attorney-referrals';
 const payload=JSON.stringify({from:config.APPROVAL_EMAIL_FROM,to:[email],subject:'A potential client is waiting for your response on LawVetter',...inquiryEmail({title:'A potential client is waiting',message:'Hello '+lead.attorney_name+',\n\nSomeone contacted you through your LawVetter profile. Their inquiry is waiting in your LawVetter inbox. Sign in to review their message and contact information.',button:'View your LawVetter inbox',url,note:lead.verified_email?'Client details stay in your private inbox. This inquiry does not establish an attorney-client relationship.':'First time here? Create an attorney account and claim your profile. Ownership must be approved before you can read client details. This inquiry does not establish an attorney-client relationship.'})});
 await db.prepare("INSERT OR IGNORE INTO referral_notifications(id,lead_id,owner_id,email,payload,first_attempt) VALUES(?,?,?,?,?,?)").bind(id,leadId,lead.owner_id,email,payload,now).run();
 await db.prepare('UPDATE referral_notifications SET owner_id=? WHERE id=?').bind(lead.owner_id,id).run();
 const row=await db.prepare('SELECT provider_id,status,first_attempt,payload FROM referral_notifications WHERE id=?').bind(id).first<{provider_id:string;status:string;first_attempt:number;payload:string}>();if(row?.provider_id)return row.status;if(!row||now-row.first_attempt>23*3600000)return 'check-provider';
 const lease=await db.prepare("UPDATE referral_notifications SET lease=? WHERE id=? AND lease<=? AND provider_id='' AND EXISTS(SELECT 1 FROM attorneys a WHERE a.bar_number=?)").bind(now+30000,id,now,lead.attorney_bar).run();if(!lease.meta.changes)return 'pending';let provider='';
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'attorney-referral/'+id},body:row.payload,signal:AbortSignal.timeout(10000)}),result=await r.json() as {id?:string};if(r.ok&&result.id)provider=result.id;}catch{}
 await db.prepare('UPDATE referral_notifications SET provider_id=?,status=?,lease=0 WHERE id=?').bind(provider,provider?'accepted':'pending',id).run();return provider?'accepted':'pending';
}
