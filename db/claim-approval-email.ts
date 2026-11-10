import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {escapeHtml,mailButton} from './mail-markup';

export async function sendClaimApproval(id:string){
 try{
  const row=await rawDb().prepare("SELECT c.email,c.full_name,c.review_note,c.bar_number,c.reviewed_at,a.name FROM profile_claims c JOIN attorney_profiles p ON p.bar_number=c.bar_number AND p.owner_id=c.user_id JOIN attorneys a ON a.bar_number=c.bar_number WHERE c.id=? AND c.status='approved'").bind(id).first<{email:string;full_name:string;review_note:string;bar_number:string;reviewed_at:string;name:string}>();
  const config=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};
  if(!row?.email||!config.RESEND_API_KEY)return 'unavailable';
  const url='https://www.lawvetter.com/account?bar='+encodeURIComponent(row.bar_number);
  const message=`Hello ${row.full_name},\n\nYour claim for ${row.name} has been approved. You now have access to manage your attorney profile on LawVetter.\n\nLog in with your existing LawVetter email and password, then select Edit profile to update your photo, biography, practice areas, website, and LinkedIn profile. You can also view your profile activity and client referrals.`;
  const note=row.review_note?'\n\nReview note: '+row.review_note:'';
  const key=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id+'|'+row.reviewed_at));
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'claim-approved/'+Array.from(new Uint8Array(key),b=>b.toString(16).padStart(2,'0')).join('')},body:JSON.stringify({from:config.APPROVAL_EMAIL_FROM||'LawVetter <no-reply@lawvetter.com>',to:[row.email],subject:'Your LawVetter attorney profile claim is approved',text:message+note+'\n\nManage your profile: '+url,html:'<h1>Your profile claim is approved</h1>'+message.split('\n\n').map(p=>'<p>'+escapeHtml(p)+'</p>').join('')+(note?'<p>'+escapeHtml(note)+'</p>':'')+mailButton('Manage your profile',url)}),signal:AbortSignal.timeout(8000)});
  const result=await response.json() as {id?:string};return response.ok&&result.id?'accepted':'unavailable';
 }catch{return 'unavailable';}
}
