import {env} from 'cloudflare:workers';
import {createHash} from 'node:crypto';
import {rawDb} from './raw';
import {SITE_ORIGIN} from '../app/seo';
// Persist the exact payload so uncertain retries use Resend's same idempotency key.
export async function notifyFirmClaim(id:string){
 try{
 const db=rawDb(),c=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string;CLAIM_ADMIN_EMAIL?:string};
 const claim=await db.prepare("SELECT c.firm_name,c.firm_email,c.submitted_at,p.legal_name,p.email FROM firm_claims c JOIN client_profiles p ON p.user_id=c.user_id WHERE c.id=? AND c.status='pending'").bind(id).first<{firm_name:string;firm_email:string;submitted_at:string;legal_name:string;email:string}>();
 if(!claim)return 'unneeded';if(!c.RESEND_API_KEY||!c.CLAIM_ADMIN_EMAIL)return 'unavailable';
 const key='firm-claim-notice:'+createHash('sha256').update(id+':'+claim.submitted_at).digest('hex');
 const payload=JSON.stringify({from:c.APPROVAL_EMAIL_FROM||'LawVetter <no-reply@lawvetter.com>',to:[c.CLAIM_ADMIN_EMAIL],subject:'New firm access request: '+claim.firm_name,text:claim.legal_name+' submitted a request to manage '+claim.firm_name+'.\n\nAccount: '+claim.email+'\nFirm email: '+claim.firm_email+'\n\nConfirmation of an email on the recorded firm domain automatically grants access if the firm has no existing manager. Other requests need your review. Check the dashboard for current status.\n\n'+SITE_ORIGIN+'/admin/firm-claims'});
 await db.prepare('INSERT OR IGNORE INTO site_settings(key,value,updated_at) VALUES(?,?,?)').bind(key,JSON.stringify({payload,started:Date.now()}),new Date().toISOString()).run();
 const row=await db.prepare('SELECT value FROM site_settings WHERE key=?').bind(key).first<{value:string}>(),delivery=JSON.parse(row!.value) as {payload:string;started:number;providerId?:string};
 if(delivery.providerId)return 'accepted';if(Date.now()-delivery.started>23*3600000)return 'check-provider';
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:delivery.payload,signal:AbortSignal.timeout(10000)}),result=await response.json() as {id?:string};
 if(!response.ok||!result.id)return 'unavailable';
 await db.prepare('UPDATE site_settings SET value=?,updated_at=? WHERE key=?').bind(JSON.stringify({...delivery,providerId:result.id}),new Date().toISOString(),key).run();return 'accepted';
 }catch{return 'unavailable';}
}
