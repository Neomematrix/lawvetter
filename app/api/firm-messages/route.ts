import {rawDb} from '../../../db/raw';
import {clientIdentity} from '../../../db/client-auth';
import {adminIdentity} from '../../../db/admin-auth';
import {firmAccess,firmAccessGuard,firmRecord} from '../../../db/firm-access';
import {firmKey} from '../attorneys/firm';
import {allowDirectoryAttempt,checkDirectoryCaptcha} from '../../../db/directory-protection';
import {firmText} from '../../firm-management-fields';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const url=new URL(request.url),key=firmKey((url.searchParams.get('firm')||'').slice(0,200)),client=await clientIdentity(request),admin=await adminIdentity(request);if(!admin&&(!client||!await firmAccess(client.user,key)))return json({error:'Approved firm access is required to read this inbox.'},403);const page=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get('page'))||0))),db=rawDb();
 const [messages,stats]=await Promise.all([db.prepare('SELECT id,name,email,phone,city,message,status,created_at FROM firm_messages WHERE firm_key=? ORDER BY created_at DESC LIMIT 25 OFFSET ?').bind(key,page*25).all(),db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS unread FROM firm_messages WHERE firm_key=?").bind(key).first()]);return json({messages:messages.results,stats,page});
 }catch{return json({error:'Unable to load the firm inbox.'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);const raw=await request.text();if(raw.length>12000)return json({error:'Message too long.'},413);const data=JSON.parse(raw);if(!data||typeof data!=='object')return json({error:'Invalid message.'},400);const key=firmKey(typeof data.firm==='string'?data.firm.slice(0,200):''),db=rawDb(),now=new Date().toISOString();
 if(data.action==='status'){
  const client=await clientIdentity(request),admin=await adminIdentity(request);if(!admin&&(!client||!await firmAccess(client.user,key)))return json({error:'Approved firm access is required.'},403);if(typeof data.id!=='string'||!['read','follow-up','closed','new'].includes(data.status))return json({error:'Choose a valid message status.'},400);
  const result=await db.prepare('UPDATE firm_messages SET status=?,updated_at=? WHERE id=? AND firm_key=? AND (?=1 OR '+firmAccessGuard+')').bind(data.status,now,data.id,key,admin?1:0,key,client?.user||'').run();return result.meta.changes?json({saved:true}):json({error:'Message or access no longer exists.'},403);
 }
 if(data.action!=='send'||!await firmRecord(key))return json({error:'Choose an existing firm.'},404);if(!await allowDirectoryAttempt(request,'firm-message',20))return json({error:'Too many messages. Please try again later.'},429);const captchaError=await checkDirectoryCaptcha(request,data.captchaToken,'firm_contact');if(captchaError)return json({error:captchaError},400);
 const name=firmText(data,'name',150),email=firmText(data,'email',254).toLowerCase(),phone=firmText(data,'phone',80),city=firmText(data,'city',120),message=firmText(data,'message',5000);if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||message.length<20||data.consent!==true)return json({error:'Enter your name, email, and a message of at least 20 characters, and confirm permission to share it with the firm.'},400);if(data.companyWebsite)return json({error:'Unable to send this message.'},400);
 await db.prepare("INSERT INTO firm_messages(id,firm_key,name,email,phone,city,message,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'new',?,?)").bind(crypto.randomUUID(),key,name,email,phone,city,message,now,now).run();return json({sent:true},201);
 }catch(error){return json({error:error instanceof Error?error.message:'Unable to send the message.'},400);}}
