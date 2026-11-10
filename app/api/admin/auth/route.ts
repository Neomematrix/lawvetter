import {env} from 'cloudflare:workers';
import {randomBytes,randomInt} from 'node:crypto';
import {rawDb} from '../../../../db/raw';
import {adminEmail,adminIdentity,adminToken,adminCookie,adminSessionMs} from '../../../../db/admin-auth';
import {allowAuth,digest,hashPassword,checkPassword} from '../../../../db/client-auth';
import {decryptSecret,matchingStep,recoveryHash} from '../../../../db/admin-mfa';
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
 if(!await allowAuth(request,'admin:'+owner))return json({error:'Too many attempts. Wait 15 minutes and try again.'},429);
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
   db.prepare('DELETE FROM admin_challenges WHERE email=?').bind(owner),
   db.prepare('DELETE FROM admin_sessions WHERE email=? AND EXISTS(SELECT 1 FROM admin_password_tokens WHERE token_hash=? AND email=? AND expires_at>?)').bind(owner,hash,owner,validAt),
   db.prepare('DELETE FROM admin_password_tokens WHERE email=? AND EXISTS(SELECT 1 FROM admin_password_tokens WHERE token_hash=? AND email=? AND expires_at>?)').bind(owner,hash,owner,validAt)
  ]);if(!result[0].meta.changes)return json({error:'The setup link is invalid or expired. Request a new one.'},400);
  return json({ok:true,message:'Password saved. Sign in with your administrator email and new password.'},200,adminCookie(''));
 }
 if(d.action==='verify'){
  const challenge=typeof d.challenge==='string'?d.challenge:'',code=typeof d.code==='string'?d.code:'';
  if(!/^[a-f0-9]{64}$/.test(challenge)||(!/^\d{6}$/.test(code)&&! /^[A-Fa-f0-9-]{20,24}$/.test(code)))return json({error:'Enter the six-digit verification code.'},400);
  const hash=digest(challenge),now=Date.now();
  await db.prepare('UPDATE admin_challenges SET attempts=attempts+1 WHERE token_hash=? AND email=?').bind(hash,owner).run();
  const session=randomBytes(32).toString('hex');
  const pending=await db.prepare('SELECT method FROM admin_challenges WHERE token_hash=? AND email=? AND expires_at>? AND attempts<=5').bind(hash,owner,now).first<{method:string}>();
  if(pending?.method==='totp'){
   const mfa=await db.prepare('SELECT secret,last_step FROM admin_mfa WHERE email=? AND enabled=1').bind(owner).first<{secret:string;last_step:number}>();
   if(!mfa)return json({error:'Authenticator verification is unavailable.'},401);
   const step=matchingStep(decryptSecret(mfa.secret,owner),code,now,mfa.last_step),sessionHash=digest(session);
   const insert=step!==null?db.prepare("INSERT INTO admin_sessions(token_hash,email,expires_at,last_seen) SELECT ?,c.email,?,? FROM admin_challenges c JOIN admin_mfa m ON m.email=c.email WHERE c.token_hash=? AND c.email=? AND c.method='totp' AND c.expires_at>? AND c.attempts<=5 AND m.enabled=1 AND m.secret=? AND m.last_step<?").bind(sessionHash,now+adminSessionMs,now,hash,owner,now,mfa.secret,step):db.prepare("INSERT INTO admin_sessions(token_hash,email,expires_at,last_seen) SELECT ?,c.email,?,? FROM admin_challenges c JOIN admin_recovery_codes r ON r.email=c.email JOIN admin_mfa m ON m.email=c.email WHERE c.token_hash=? AND c.email=? AND c.method='totp' AND c.expires_at>? AND c.attempts<=5 AND r.code_hash=? AND m.enabled=1").bind(sessionHash,now+adminSessionMs,now,hash,owner,now,recoveryHash(code));
   const consume=step!==null?db.prepare('UPDATE admin_mfa SET last_step=? WHERE email=? AND EXISTS(SELECT 1 FROM admin_sessions WHERE token_hash=?)').bind(step,owner,sessionHash):db.prepare('DELETE FROM admin_recovery_codes WHERE email=? AND code_hash=? AND EXISTS(SELECT 1 FROM admin_sessions WHERE token_hash=?)').bind(owner,recoveryHash(code),sessionHash);
   const result=await db.batch([insert,consume,db.prepare('DELETE FROM admin_challenges WHERE token_hash=? AND (attempts>=5 OR expires_at<=? OR EXISTS(SELECT 1 FROM admin_sessions WHERE token_hash=?))').bind(hash,now,sessionHash)]);
   if(!result[0].meta.changes)return json({error:'Invalid or previously used code. Use the current Authenticator code or an unused recovery code.'},401);
   return json({ok:true},200,adminCookie(session));
  }
  if(await db.prepare('SELECT email FROM admin_mfa WHERE email=? AND enabled=1').bind(owner).first())return json({error:'Sign in again and use Google Authenticator.'},401);
  const result=await db.batch([
   db.prepare('INSERT INTO admin_sessions(token_hash,email,expires_at,last_seen) SELECT ?,email,?,? FROM admin_challenges WHERE token_hash=? AND email=? AND code_hash=? AND expires_at>? AND attempts<=5').bind(digest(session),now+adminSessionMs,now,hash,owner,digest(challenge+':'+code),now),
   db.prepare('DELETE FROM admin_challenges WHERE token_hash=? AND (code_hash=? OR attempts>=5 OR expires_at<=?)').bind(hash,digest(challenge+':'+code),now)
  ]);
  if(!result[0].meta.changes)return json({error:'The code is incorrect or expired. After five attempts, sign in again.'},401);
  return json({ok:true},200,adminCookie(session));
 }
 if(d.action==='login'){
  const row=email===owner?await db.prepare('SELECT password_hash FROM admin_credentials WHERE email=?').bind(owner).first<{password_hash:string}>():null;
  if(!checkPassword(password,row?.password_hash||''))return json({error:'Email or password is incorrect.'},401);
  const mfa=await db.prepare('SELECT enabled FROM admin_mfa WHERE email=? AND enabled=1').bind(owner).first();
  if(mfa){const challenge=randomBytes(32).toString('hex'),hash=digest(challenge);await db.batch([db.prepare('DELETE FROM admin_challenges WHERE email=? OR expires_at<=?').bind(owner,Date.now()),db.prepare("INSERT INTO admin_challenges(token_hash,email,code_hash,expires_at,method) VALUES(?,?,?,?,'totp')").bind(hash,owner,digest(randomBytes(32).toString('hex')),Date.now()+600000)]);return json({ok:true,requiresCode:true,challenge,method:'totp'});}
  const c=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};
  if(!c.RESEND_API_KEY||!c.APPROVAL_EMAIL_FROM)return json({error:'Verification email is unavailable. Please try again later.'},503);
  const challenge=randomBytes(32).toString('hex'),code=String(randomInt(0,1000000)).padStart(6,'0'),hash=digest(challenge);
  await db.batch([db.prepare('DELETE FROM admin_challenges WHERE email=? OR expires_at<=?').bind(owner,Date.now()),db.prepare('INSERT INTO admin_challenges(token_hash,email,code_hash,expires_at) VALUES(?,?,?,?)').bind(hash,owner,digest(challenge+':'+code),Date.now()+600000),db.prepare('DELETE FROM admin_sessions WHERE expires_at<=? OR last_seen<=?').bind(Date.now(),Date.now()-adminSessionMs)]);
  let sent=false;try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'admin-verification/'+hash},body:JSON.stringify({from:c.APPROVAL_EMAIL_FROM,to:[owner],subject:'Your LawVetter admin verification code',text:'Your administrator verification code is '+code+'. It expires in 10 minutes. Do not share this code. If you did not attempt to sign in, reset your administrator password.'}),signal:AbortSignal.timeout(10000)});sent=r.ok;}catch{}
  if(!sent){await db.prepare('DELETE FROM admin_challenges WHERE token_hash=?').bind(hash).run();return json({error:'Unable to deliver the verification code. Try signing in again.'},503);}
  return json({ok:true,requiresCode:true,challenge});
 }
 return json({error:'Unknown action.'},400);
 }catch{return json({error:'Administrator login is temporarily unavailable. Please try again.'},503);}
}
