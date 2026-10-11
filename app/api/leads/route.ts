import {rawDb} from '../../../db/raw';
import {profileIdentity} from '../../../db/profile-access';
import {practiceAreas} from '../../practice-areas';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 if(!profileIdentity(request).admin)return reply({error:'Only the site owner can view client leads.'},403);
 try{const page=Math.max(1,Number.parseInt(new URL(request.url).searchParams.get('page')||'1')||1),db=rawDb();const [leads,count]=await Promise.all([db.prepare('SELECT * FROM client_leads ORDER BY created_at DESC,id LIMIT 25 OFFSET ?').bind((page-1)*25).all(),db.prepare('SELECT count(*) AS total FROM client_leads').first<{total:number}>()]);return reply({leads:leads.results,total:count?.total||0,page});}catch{return reply({error:'Leads are temporarily unavailable. Please try again.'},503);}
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Please submit this form from LawVetter.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'Unsupported form format.'},415);
 try{
 const text=await request.text();if(text.length>16000)return reply({error:'Your message is too long.'},413);
 let x:Record<string,unknown>;try{x=JSON.parse(text);if(!x||typeof x!=='object')throw Error();}catch{return reply({error:'Invalid form data.'},400);}
 const db=rawDb();
 if(x.action==='status'){
  if(!profileIdentity(request).admin)return reply({error:'Only the site owner can manage leads.'},403);
  if(typeof x.id!=='string'||!['new','contacted','closed'].includes(String(x.status)))return reply({error:'Invalid lead status.'},400);
  const result=await db.prepare('UPDATE client_leads SET status=?,updated_at=? WHERE id=?').bind(x.status,new Date().toISOString(),x.id).run();
  return result.meta.changes?reply({ok:true}):reply({error:'Lead not found.'},404);
 }
 const read=(key:string)=>typeof x[key]==='string'?(x[key] as string).trim():'';
 const id=read('id'),name=read('name'),email=read('email').toLowerCase(),phone=read('phone'),city=read('city'),practice=read('practice'),summary=read('summary'),contact=read('contactMethod');
 if(read('website'))return reply({error:'Unable to submit this request.'},400);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||name.length<2||name.length>120||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||city.length<2||city.length>120||summary.length<20||summary.length>3000||phone.length>40||!['email','phone'].includes(contact)||(contact==='phone'&&phone.replace(/\D/g,'').length<7)||!practiceAreas.some(a=>a.id===practice)&&practice!=='other'||x.consent!==true)return reply({error:'Complete the required fields and contact consent. Please use at least 20 characters to describe your request.'},400);
 const existing=await db.prepare('SELECT email FROM client_leads WHERE id=?').bind(id).first<{email:string}>();if(existing)return existing.email===email?reply({ok:true}):reply({error:'Please reload the form and try again.'},409);
 const recent=await db.prepare('SELECT count(*) AS total FROM client_leads WHERE email=? AND created_at>?').bind(email,new Date(Date.now()-3600000).toISOString()).first<{total:number}>();if((recent?.total||0)>=3)return reply({error:'You have already sent several requests. Please try again later.'},429);
 const now=new Date().toISOString();await db.prepare('INSERT OR IGNORE INTO client_leads(id,name,email,phone,city,practice,summary,contact_method,consent_version,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,name,email,phone,city,practice,summary,contact,'contact-v1','new',now,now).run();return reply({ok:true},201);
 }catch{return reply({error:'We could not save your request. Your information is still in the form; please try again.'},503);}
}
