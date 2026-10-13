import {env} from 'cloudflare:workers';

const config=()=>env as unknown as {RESEND_API_KEY?:string};

export function passwordResetEmailConfigured(){
 const c=config();
 return !!c.RESEND_API_KEY;
}

export async function sendPasswordResetEmail(recipient:string,token:string,origin:string){
 const c=config();
 if(!passwordResetEmailConfigured())return false;
 const resetUrl=origin+'/reset-password?reset='+encodeURIComponent(token);
 const payload=JSON.stringify({
  from:'LawVetter <no-reply@lawvetter.com>',
  to:[recipient],
  subject:'Reset your LawVetter password',
  text:'We received a request to reset your LawVetter password. Use the secure link below within 30 minutes.\n\n'+resetUrl+'\n\nIf you did not request this change, you can ignore this email. Your password will remain unchanged.',
 });
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'password-reset-'+token.slice(0,32)},body:payload,signal:AbortSignal.timeout(10000)});
  if(!response.ok)return false;
  const result=await response.json() as {id?:string};
  return !!result.id;
 }catch{return false;}
}
