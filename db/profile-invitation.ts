import {env} from 'cloudflare:workers';
import {createHash} from 'node:crypto';
import {rawDb} from './raw';
import {SITE_ORIGIN,attorneyPath} from '../app/seo';
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
type Delivery={payload:string;started:number;providerId?:string};
export async function profileInvitation(userId:string,publicId:string){
 const db=rawDb();
 const client=await db.prepare('SELECT user_id,first_name,legal_name,email FROM client_profiles WHERE user_id=?').bind(userId).first<{user_id:string;first_name:string;legal_name:string;email:string}>();
 const attorney=await db.prepare('SELECT bar_number,public_id,name,company,email FROM attorneys WHERE public_id=?').bind(publicId).first<{bar_number:string;public_id:string;name:string;company:string;email:string}>();
 if(!client||!attorney)throw Error('Account or attorney profile not found.');
 const config=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};
 const from=config.APPROVAL_EMAIL_FROM||'LawVetter <no-reply@lawvetter.com>';
 const text=`Hi ${client.first_name||client.legal_name},\n\nThank you for joining LawVetter! Are you ${attorney.name}${attorney.company?' of '+attorney.company:''}, listed on this profile?\n\n${SITE_ORIGIN+attorneyPath(attorney)}\n\nIf so, we can help connect your account to your attorney profile. ${attorney.email?'You can verify through your listed professional email, '+attorney.email+', or submit your bar card through LawVetter’s profile-claim process for review.':'You can submit your bar card through LawVetter’s profile-claim process for review.'}\n\nTo get started, sign in with your existing account and open the profile-claim form:\n${SITE_ORIGIN}/account?bar=LV${publicId}\n\nOnce verification is complete, you’ll be able to manage your profile.\n\nThank you,\nLawVetter`;
 const payload=JSON.stringify({from,to:[client.email],subject:'Connect your LawVetter attorney profile',text});
 const key='profile-invitation:'+digest(JSON.stringify([userId,publicId]));
 const row=await db.prepare('SELECT value FROM site_settings WHERE key=?').bind(key).first<{value:string}>();
 const delivery:Delivery|undefined=row?JSON.parse(row.value):undefined;
 return {from,to:client.email,subject:'Connect your LawVetter attorney profile',text,fingerprint:digest(payload),payload,key,delivery,configured:!!config.RESEND_API_KEY};
}
export async function sendProfileInvitation(userId:string,publicId:string,fingerprint:string,actor:string){
 const draft=await profileInvitation(userId,publicId),db=rawDb();
 if(draft.fingerprint!==fingerprint)throw Error('The account or profile changed. Preview the message again.');
 if(draft.delivery?.providerId)return {status:'accepted',alreadySent:true};
 if(!draft.configured)throw Error('LawVetter email is not configured.');
 const initial:Delivery={payload:draft.payload,started:Date.now()};
 await db.prepare('INSERT OR IGNORE INTO site_settings(key,value,updated_at) VALUES(?,?,?)').bind(draft.key,JSON.stringify(initial),new Date().toISOString()).run();
 const row=await db.prepare('SELECT value FROM site_settings WHERE key=?').bind(draft.key).first<{value:string}>();
 const delivery:Delivery=JSON.parse(row!.value);
 if(delivery.providerId)return {status:'accepted',alreadySent:true};
 // Reuse the exact payload and provider key for concurrent requests or uncertain retries.
 if(delivery.payload!==draft.payload)throw Error('An earlier send is pending. Check email delivery before changing this message.');
 if(Date.now()-delivery.started>23*3600000)throw Error('Delivery is uncertain. Check Resend before retrying; automatic resend is blocked to prevent duplicates.');
 const config=env as unknown as {RESEND_API_KEY:string};
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':draft.key},body:delivery.payload,signal:AbortSignal.timeout(12000)});
 const result=await response.json() as {id?:string};
 if(!response.ok||!result.id)throw Error('Email was not confirmed as sent. You can retry this same message safely.');
 await db.batch([
  db.prepare('UPDATE site_settings SET value=?,updated_at=? WHERE key=?').bind(JSON.stringify({...delivery,providerId:result.id}),new Date().toISOString(),draft.key),
  db.prepare('INSERT OR IGNORE INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(draft.key,actor,'profile-invitation-sent',userId,new Date().toISOString())
 ]);
 return {status:'accepted',alreadySent:false};
}
