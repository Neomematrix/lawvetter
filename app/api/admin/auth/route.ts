import {env} from 'cloudflare:workers';
import {randomBytes} from 'node:crypto';
import {rawDb} from '../../../../db/raw';
import {adminEmail,adminIdentity,adminToken,adminCookie,createAdminSession} from '../../../../db/admin-auth';
import {allowAuth,digest,hashPassword,checkPassword} from '../../../../db/client-auth';
import {SITE_ORIGIN} from '../../../seo';
const json=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const message='If this is the administrator email, a secure password setup or reset link will arrive shortly. Check your inbox and spam folder.';
export async function GET(request:Request){try{return json({authenticated:!!await adminIdentity(request)});}catch{return json({error:'Administrator login is temporarily unavailable.'},503);}}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 try{const raw=await request.text();if(raw.length>3000)return json({error:'Request too large.'},413);let d:Record<string,unknown>;try{d=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}if(!d||typeof d!=='object'||Array.isArray(d))return json({error:'Invalid request.'},400);
 const email=typeof d.email==='string'?d.email.trim().toLowerCase():'',password=typeof d.password==='string'?d.password:'',owner=adminEmail(),db=rawDb();
 if(d.action==='logout'){await db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(digest(adminToken(request))).run();return json({ok:true},200,adminCookie(''));}
 if(!owner)return json({error:'Administrator login is not configured.'},503);
 if(email.length>254||password.length>128)return json({error:'Invalid credentials.'},400);
 if(!await allowAuth(request,'admin:'+email))return json({error:'Too many attempts. Wait 15 minutes and try again.'},429);
 if(d.action==='request-reset'){
  const c=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};if(!c.RESEND_API_KEY||!c.APPROVAL_EMAIL_FROM)return json({error:'Administrator email is temporarily unavailable.'},503);
  if(email===owner){const token=randomBytes(32).toString('hex'),hash=digest(token);await db.batch([db.prepare('DELETE FROM admin_password_tokens WHERE email=? OR expires_at<=?').bind(owner,Date.now()),db.prepare('INSERT INTO admin_password_tokens(token_hash,email,expires_at) VALUES(?,?,?)').bind(hash,owner,Date.now()+1800000)]);
   const url=SITE_ORIGIN+'/admin-login?setup='+token;let sent=false;try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'admin-password/'+hash},body:JSON.stringify({from:c.APPROVAL_EMAIL_FROM,to:[owner],subject:'Set your LawVetter administrator password',text:'Use this one-time link within 30 minutes to set or reset your administrator password. This is for the private LawVetter administrator account only.\n\n'+url+'\n\nIf you did not request this email, ignore it. Your password will not change.'}),signal:AbortSignal.timeout(10000)});sent=r.ok;}catch{}if(!sent)await db.prepare('DELETE FROM admin_password_tokens WHERE token_hash=?').bind(hash).run();
  }return json({ok:true,message});
 }
 if(d.action==='reset'){
  const token=typeof d.token==='string'?d.token:'';if(!/^[a-f0-9]{64}$/.test(token))return json({error:'The setup link is invalid or expired. Request a new one.'},400);
  if(password.length<12)return json({error:'Choose a password with at least 12 characters.'},400);
  const hash=digest(token),now=Date.now(),row=await db.prepare('SELECT email FROM admin_password_tokens WHERE token_hash=? AND email=? AND expires_at>?').bind(hash,owner,now).first();if(!row)return json({error:'The setup link is invalid or expired. Request a new one.'},400);
  const encoded=hashPassword(password),validAt=Date.now(),updated=new Date().toISOString();const result=await db.batch([
   db.prepare('INSERT INTO admin_credentials(email,password_hash,updated_at) SELECT email,?,? FROM admin_password_tokens WHERE token_hash=? AND email=? AND expires_at>? ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at').bind(encoded,updated,hash,owner,validAt),
   db.prepare('DELETE FROM admin_sessions WHERE email=? AND EXISTS(SELECT 1 FROM admin_password_tokens WHERE token_hash=? AND email=? AND expires_at>?)').bind(owner,hash,owner,validAt),
   db.prepare('DELETE FROM admin_password_tokens WHERE email=? AND EXISTS(SELECT 1 FROM admin_password_tokens WHERE token_hash=? AND email=? AND expires_at>?)').bind(owner,hash,owner,validAt)
  ]);if(!result[0].meta.changes)return json({error:'The setup link is invalid or expired. Request a new one.'},400);
  return json({ok:true,message:'Password saved. Sign in with your administrator email and new password.'},200,adminCookie(''));
 }
 if(d.action==='login'){
  const row=email===owner?await db.prepare('SELECT password_hash FROM admin_credentials WHERE email=?').bind(owner).first<{password_hash:string}>():null;
  if(!checkPassword(password,row?.password_hash||''))return json({error:'Email or password is incorrect.'},401);
  await db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(Date.now()).run();return json({ok:true},200,adminCookie(await createAdminSession(owner)));
 }
 return json({error:'Unknown action.'},400);
 }catch{return json({error:'Administrator login is temporarily unavailable. Please try again.'},503);}
}
