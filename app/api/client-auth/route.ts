import {rawDb} from '../../../db/raw';
import {profileIdentity} from '../../../db/profile-access';
import {clientIdentity,hashPassword,checkPassword,newSession,sessionCookie,sessionToken,digest,allowAuth} from '../../../db/client-auth';
import {passwordResetEmailConfigured,sendPasswordResetEmail} from '../../../db/password-reset-email';
import {randomBytes} from 'node:crypto';
const json=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const resetMessage='If a LawVetter account uses that email address, you will receive a password-reset link. Check your inbox and spam folder.';
export async function GET(request:Request){try{const passwordResetAvailable=passwordResetEmailConfigured(),client=await clientIdentity(request);if(client)return json({client,passwordResetAvailable});const platform=(await profileIdentity(request));const legacy=platform.user?await rawDb().prepare('SELECT first_name,last_name,email FROM client_profiles p WHERE user_id=? AND lower(trim(email))=? AND NOT EXISTS(SELECT 1 FROM client_passwords c WHERE c.user_id=p.user_id)').bind(platform.user,platform.email).first():null;const attorneyLegacy=platform.user?await rawDb().prepare('SELECT a.name FROM attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number WHERE p.owner_id=? AND NOT EXISTS(SELECT 1 FROM client_passwords WHERE user_id=?) LIMIT 1').bind(platform.user,platform.user).first<{name:string}>():null;return json({client:null,legacy,attorneyLegacy:attorneyLegacy?{name:attorneyLegacy.name,email:platform.email}:null,passwordResetAvailable});}catch{return json({error:'Account service is temporarily unavailable.'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 const text=await request.text();if(text.length>10000)return json({error:'Request too large.'},413);
 let d:Record<string,unknown>;try{d=JSON.parse(text);}catch{return json({error:'Invalid request.'},400);}if(!d||typeof d!=='object'||Array.isArray(d))return json({error:'Invalid request.'},400);
 const db=rawDb(),action=str(d.action),email=str(d.email).toLowerCase(),password=typeof d.password==='string'?d.password:'',now=new Date().toISOString();
 if(action==='logout'){await db.prepare('DELETE FROM client_sessions WHERE token_hash=?').bind(digest(sessionToken(request))).run();return json({saved:true},200,sessionCookie(''));}
 if(!['register','login','set-password','change-password','request-password-reset','reset-password'].includes(action))return json({error:'Unknown action.'},400);
 if(action==='request-password-reset'){
  if(!passwordResetEmailConfigured())return json({error:'Password-reset email is temporarily unavailable.'},503);
  if(!await allowAuth(request,email))return json({error:'Too many attempts. Please wait 15 minutes and try again.'},429);
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254){
   const account=await db.prepare('SELECT user_id FROM client_account_emails WHERE email=?').bind(email).first<{user_id:string}>();
   if(account){
    const token=randomBytes(32).toString('hex'),tokenHash=digest(token),expiresAt=Date.now()+30*60*1000;
    await db.batch([db.prepare('DELETE FROM client_password_reset_tokens WHERE user_id=? OR expires_at<=?').bind(account.user_id,Date.now()),db.prepare('INSERT INTO client_password_reset_tokens(token_hash,user_id,expires_at,requested_at) VALUES(?,?,?,?)').bind(tokenHash,account.user_id,expiresAt,now)]);
    if(!await sendPasswordResetEmail(email,token,new URL(request.url).origin)){await db.prepare('DELETE FROM client_password_reset_tokens WHERE token_hash=?').bind(tokenHash).run();console.error('LawVetter password-reset email delivery failed; check Resend configuration and provider logs.');}
   }
  }
  return json({accepted:true,message:resetMessage});
 }
 if(action==='reset-password'){
  const token=str(d.token);
  if(!await allowAuth(request,'reset:'+digest(token)))return json({error:'Too many attempts. Please wait 15 minutes and try again.'},429);
  if(!/^[a-f0-9]{64}$/.test(token))return json({error:'This password-reset link is invalid or has expired. Request a new one.'},400);
  if(!password)return json({error:'Enter your new password.'},400);
  if(password.length<9)return json({error:'Password must be at least 9 characters.'},400);
  if(password.length>128)return json({error:'Password is too long.'},400);
  const tokenHash=digest(token),reset=await db.prepare('SELECT user_id FROM client_password_reset_tokens WHERE token_hash=? AND expires_at>?').bind(tokenHash,Date.now()).first<{user_id:string}>();
  if(!reset)return json({error:'This password-reset link is invalid or has expired. Request a new one.'},400);
  const newHash=hashPassword(password),validAt=Date.now();
  const results=await db.batch([db.prepare('DELETE FROM client_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM client_password_reset_tokens WHERE token_hash=? AND user_id=? AND expires_at>?)').bind(reset.user_id,tokenHash,reset.user_id,validAt),db.prepare('UPDATE client_passwords SET password_hash=?,updated_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM client_password_reset_tokens WHERE token_hash=? AND user_id=? AND expires_at>?)').bind(newHash,now,reset.user_id,tokenHash,reset.user_id,validAt),db.prepare('DELETE FROM client_password_reset_tokens WHERE token_hash=?').bind(tokenHash)]);
  if(!results[1].meta.changes)return json({error:'This password-reset link is invalid or has expired. Request a new one.'},400);
  return json({saved:true},200,sessionCookie(''));
 }
 if(!await allowAuth(request,email))return json({error:'Too many attempts. Please wait 15 minutes and try again.'},429);
 if(!password)return json({error:'Enter your password.'},400);
 if(password.length>128)return json({error:'Password is too long.'},400);
 if(action==='login'){
  const row=await db.prepare('SELECT p.user_id,c.password_hash FROM client_account_emails e JOIN client_profiles p ON p.user_id=e.user_id JOIN client_passwords c ON c.user_id=p.user_id WHERE e.email=?').bind(email).first<{user_id:string;password_hash:string}>();
  if(!checkPassword(password,row?.password_hash||''))return json({error:'Email or password is incorrect.'},401);
  return json({saved:true},200,sessionCookie(await newSession(row!.user_id)));
 }
 if(password.length<9)return json({error:'Password must be at least 9 characters.'},400);
 if(action==='change-password'){
  const client=await clientIdentity(request);if(!client)return json({error:'Log in first.'},401);
  const old=typeof d.currentPassword==='string'?d.currentPassword:'';if(old.length>128)return json({error:'Current password is incorrect.'},401);
  const row=await db.prepare('SELECT password_hash FROM client_passwords WHERE user_id=?').bind(client.user).first<{password_hash:string}>();
  if(!checkPassword(old,row?.password_hash||''))return json({error:'Current password is incorrect.'},401);
  await db.batch([db.prepare('UPDATE client_passwords SET password_hash=?,updated_at=? WHERE user_id=?').bind(hashPassword(password),now,client.user),db.prepare('DELETE FROM client_sessions WHERE user_id=?').bind(client.user)]);
  return json({saved:true},200,sessionCookie(await newSession(client.user)));
 }
 const platform=(await profileIdentity(request));
 if(action==='set-password'){
  if(!platform.user||!platform.email)return json({error:'Sign in with the original ChatGPT account to secure your existing profile.'},401);
  let profile=await db.prepare('SELECT user_id FROM client_profiles WHERE user_id=? AND lower(trim(email))=?').bind(platform.user,platform.email).first();if(!profile){const owned=await db.prepare('SELECT a.name FROM attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number WHERE p.owner_id=? LIMIT 1').bind(platform.user).first<{name:string}>();if(!owned)return json({error:'Existing profile not found.'},403);const parts=owned.name.trim().split(/\s+/);try{await db.batch([db.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at,first_name,last_name,initial_docket) VALUES(?,?,?,?,?,?,?)').bind(platform.user,owned.name,platform.email,now,parts[0],parts.slice(1).join(' '),''),db.prepare('INSERT INTO client_account_emails(email,user_id) VALUES(?,?)').bind(platform.email,platform.user)]);}catch{return json({error:'This email already has an account. Contact LawVetter to reconcile your existing profile ownership.'},409);}}
  const r=await db.prepare('INSERT OR IGNORE INTO client_passwords(user_id,password_hash,updated_at) VALUES(?,?,?)').bind(platform.user,hashPassword(password),now).run();if(!r.meta.changes)return json({error:'A password is already set. Use Log in.'},409);
  await db.prepare('INSERT OR IGNORE INTO client_account_emails(email,user_id) VALUES(?,?)').bind(platform.email,platform.user).run();
  return json({saved:true},200,sessionCookie(await newSession(platform.user)));
 }
 const first=str(d.firstName),last=str(d.lastName);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!first||first.length>75||!last||last.length>75||d.consent!==true)return json({error:'Enter your first name, last name and email, and agree to private account storage.'},400);
 const existing=await db.prepare('SELECT user_id FROM client_profiles WHERE lower(trim(email))=?').bind(email).first();if(existing)return json({error:'Unable to register this email. Log in, or use your original ChatGPT account to set a password for an existing profile.'},409);
 // Never attach a new password account to an existing identity based only on typed email.
 const user='client:'+crypto.randomUUID();
 try{await db.batch([db.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at,first_name,last_name,initial_docket) VALUES(?,?,?,?,?,?,?)').bind(user,first+' '+last,email,now,first,last,''),db.prepare('INSERT INTO client_account_emails(email,user_id) VALUES(?,?)').bind(email,user),db.prepare('INSERT INTO client_passwords(user_id,password_hash,updated_at) VALUES(?,?,?)').bind(user,hashPassword(password),now)]);}catch{return json({error:'Unable to register this email. Try logging in.'},409);}
 return json({saved:true},201,sessionCookie(await newSession(user)));
 }catch{return json({error:'Account service is temporarily unavailable. Please try again.'},503);}}
