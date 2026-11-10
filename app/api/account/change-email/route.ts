import {randomBytes} from 'node:crypto';
import {rawDb} from '../../../../db/raw';
import {clientIdentity,checkPassword,digest,allowAuth,sessionCookie} from '../../../../db/client-auth';
import {viewAsToken} from '../../../../db/view-as-cookie';
import {sendEmailChange,confirmEmailChange} from '../../../../db/email-change';
const json=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 if(viewAsToken(request))return json({error:'Leave the administrator preview before changing account credentials.'},403);
 const client=await clientIdentity(request);if(!client)return json({error:'Sign in with your current email, then reopen this confirmation link.'},401);
 if(!await allowAuth(request,'email-change:'+client.user))return json({error:'Too many attempts. Please try again in 15 minutes.'},429);
 const text=await request.text();if(text.length>4096)return json({error:'Request too large.'},413);
 let data:Record<string,unknown>;try{data=JSON.parse(text);}catch{return json({error:'Invalid request.'},400);}if(!data||typeof data!=='object')return json({error:'Invalid request.'},400);
 if(data.action==='confirm'){
  if(typeof data.token!=='string'||! /^[a-f0-9]{64}$/.test(data.token))return json({error:'Invalid confirmation link.'},400);
  if(!await confirmEmailChange(client.user,data.token))return json({error:'This link has expired, was replaced, or the email is unavailable. Request another change.'},409);
  return json({saved:true},200,sessionCookie(''));
 }
 if(data.action!=='request')return json({error:'Unknown action.'},400);
 const email=typeof data.email==='string'?data.email.trim().toLowerCase():'',password=typeof data.currentPassword==='string'?data.currentPassword:'';
 if(!/^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]+$/.test(email)||email.length>254||email===client.email.toLowerCase())return json({error:'Enter a different, valid email address.'},400);
 const db=rawDb(),row=await db.prepare('SELECT password_hash FROM client_passwords WHERE user_id=?').bind(client.user).first<{password_hash:string}>();
 if(!password||password.length>128||!row||!checkPassword(password,row.password_hash))return json({error:'Current password is incorrect.'},401);
 if(await db.prepare('SELECT 1 FROM client_account_emails WHERE email=? UNION SELECT 1 FROM client_profiles WHERE lower(trim(email))=?').bind(email,email).first())return json({error:'That email is unavailable. Choose another email.'},409);
 const token=randomBytes(32).toString('hex'),hash=digest(token);
 await db.prepare('INSERT INTO client_email_changes(user_id,old_email,new_email,password_hash,token_hash,expires_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET old_email=excluded.old_email,new_email=excluded.new_email,password_hash=excluded.password_hash,token_hash=excluded.token_hash,expires_at=excluded.expires_at').bind(client.user,client.email.toLowerCase(),email,row.password_hash,hash,Date.now()+1800000).run();
 if(!await sendEmailChange(email,token)){await db.prepare('DELETE FROM client_email_changes WHERE user_id=? AND token_hash=?').bind(client.user,hash).run();return json({error:'Unable to send the confirmation email. Please try again.'},503);}
 return json({sent:true});
 }catch{return json({error:'Unable to change email. The address may be unavailable; please try again.'},409);}}
