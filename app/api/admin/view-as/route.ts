import {firmAccountSQL} from '../../../../db/account-firm';
import {randomBytes} from 'node:crypto';
import {adminIdentity,adminToken} from '../../../../db/admin-auth';
import {rawDb} from '../../../../db/raw';
import {viewAsCookie,viewAsToken} from '../../../../db/view-as-cookie';
import {viewAsDigest,viewAsIdentity} from '../../../../db/view-as';
import {accountDashboardPath} from '../../../../db/account-dashboard';
const json=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function GET(request:Request){try{
 const identity=await adminIdentity(request,{allowViewAs:true});
 if(!identity)return json({active:false,expired:!!viewAsToken(request)},viewAsToken(request)?200:401);
 const url=new URL(request.url);
 if(url.searchParams.get('status')==='1'){const user=await viewAsIdentity(request);return json({active:!!user,expired:!!viewAsToken(request)&&!user,user});}
 const q=(url.searchParams.get('q')||'').trim().slice(0,150),page=Math.min(100000,Math.max(0,Math.floor(Number(url.searchParams.get('page'))||0))),kind=url.searchParams.get('kind')||'all';
 const attorney="(EXISTS(SELECT 1 FROM attorney_profiles a WHERE a.owner_id=p.user_id) OR EXISTS(SELECT 1 FROM profile_claims c WHERE c.user_id=p.user_id))";
 const firm=firmAccountSQL();
 const filter=kind==='firm'?' AND '+firm:kind==='attorney'?' AND '+attorney+' AND NOT '+firm:kind==='client'?' AND NOT '+attorney+' AND NOT '+firm:'';
 const where='(instr(lower(p.legal_name),lower(?))>0 OR instr(lower(p.email),lower(?))>0)'+filter,db=rawDb();
 const [rows,total]=await Promise.all([db.prepare('SELECT p.user_id,p.legal_name,p.email,CASE WHEN '+firm+" THEN 'Firm' WHEN "+attorney+" THEN 'Attorney' ELSE 'Client' END AS role FROM client_profiles p WHERE "+where+' ORDER BY p.legal_name,p.user_id LIMIT 25 OFFSET ?').bind(q,q,page*25).all(),db.prepare('SELECT COUNT(*) AS count FROM client_profiles p WHERE '+where).bind(q,q).first<{count:number}>()]);
 return json({users:rows.results,total:total?.count||0,page});
}catch{return json({error:'Unable to load user accounts.'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 const text=await request.text();if(text.length>2000)return json({error:'Request too large.'},413);
 let data;try{data=JSON.parse(text);}catch{return json({error:'Invalid request.'},400);}
 if(!data||!['start','stop'].includes(data.action))return json({error:'Unknown action.'},400);
 const admin=await adminIdentity(request,{allowViewAs:true}),db=rawDb();
 // Always allow clearing an expired view cookie, without touching normal user sessions.
 if(data.action==='stop'){
  const current=admin?await viewAsIdentity(request):null;
  if(admin){const statements=[db.prepare('DELETE FROM admin_user_views WHERE admin_token_hash=?').bind(viewAsDigest(adminToken(request)))];if(current)statements.push(db.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),admin.email,'view-user-stop',current.user,new Date().toISOString()));await db.batch(statements);}
  return json({redirect:'/admin/view-as'},200,viewAsCookie(''));
 }
 if(!admin)return json({error:'Sign in as administrator.'},401);
 if(typeof data.userId!=='string'||data.userId.length>300)return json({error:'Choose a user account.'},400);
 const user=await db.prepare('SELECT user_id AS user,email FROM client_profiles WHERE user_id=?').bind(data.userId).first<{user:string;email:string}>();
 if(!user)return json({error:'User account not found.'},404);
 const redirect=await accountDashboardPath(user),token=randomBytes(32).toString('hex'),adminHash=viewAsDigest(adminToken(request)),now=Date.now();
 await db.batch([db.prepare('DELETE FROM admin_user_views WHERE admin_token_hash=? OR expires_at<=?').bind(adminHash,now),db.prepare('INSERT INTO admin_user_views(token_hash,admin_token_hash,user_id,expires_at) VALUES(?,?,?,?)').bind(viewAsDigest(token),adminHash,user.user,now+1200000),db.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),admin.email,'view-user-start',user.user,new Date(now).toISOString())]);
 return json({redirect},200,viewAsCookie(token));
}catch{return json({error:'Unable to change user view. Please try again.'},503);}}
