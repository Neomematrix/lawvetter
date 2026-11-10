import {firmAccess} from '../../../../db/firm-access';
import {firmKey} from '../../attorneys/firm';
import {createHash} from 'node:crypto';
import {adminIdentity} from '../../../../db/admin-auth';
import {rawDb} from '../../../../db/raw';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
type Attorney={bar_number:string;name:string;company:string;state:string;owner_id:string|null;owner_name:string|null;owner_email:string|null};
type Account={user_id:string;legal_name:string;email:string};
const fingerprint=(a:Attorney,u:Account)=>createHash('sha256').update(JSON.stringify([a.bar_number,a.name,a.company,a.state,u.user_id,u.legal_name,u.email])).digest('hex');
async function attorney(bar:string){return rawDb().prepare('SELECT a.bar_number,a.name,a.company,a.state,p.owner_id,c.legal_name AS owner_name,c.email AS owner_email FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number LEFT JOIN client_profiles c ON c.user_id=p.owner_id WHERE a.bar_number=?').bind(bar).first<Attorney>();}
export async function GET(request:Request){try{
 if(!await adminIdentity(request))return json({error:'Sign in as administrator.'},401);
 const url=new URL(request.url),bar=(url.searchParams.get('bar')||'').slice(0,200),q=(url.searchParams.get('q')||'').trim().slice(0,254),a=await attorney(bar);
 if(!a)return json({error:'Attorney not found.'},404);
 const users=q.length>=2&&!a.owner_id?(await rawDb().prepare('SELECT user_id,legal_name,email FROM client_profiles WHERE instr(lower(email),lower(?))>0 OR instr(lower(legal_name),lower(?))>0 ORDER BY CASE WHEN lower(email)=lower(?) THEN 0 ELSE 1 END,legal_name LIMIT 10').bind(q,q,q).all<Account>()).results:[];
 return json({attorney:{...a,firm_admin:!!a.owner_id&&await firmAccess(a.owner_id,firmKey(a.company))},users:users.map(u=>({...u,fingerprint:fingerprint(a,u)}))});
 }catch{return json({error:'Unable to load attorney access.'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 const admin=await adminIdentity(request);if(!admin)return json({error:'Sign in as administrator.'},401);
 const text=await request.text();if(text.length>2000)return json({error:'Request too large.'},413);const data=JSON.parse(text);
 if(data.verified!==true||typeof data.bar!=='string'||data.bar.length>200||typeof data.userId!=='string'||data.userId.length>200||typeof data.fingerprint!=='string')return json({error:'Choose an account and confirm you verified this person’s identity and authority.'},400);
 const db=rawDb(),a=await attorney(data.bar),u=await db.prepare('SELECT user_id,legal_name,email FROM client_profiles WHERE user_id=?').bind(data.userId).first<Account>();
 if(!a||!u)return json({error:'The attorney or account no longer exists.'},404);
 if(fingerprint(a,u)!==data.fingerprint)return json({error:'Account or attorney details changed. Search again before linking.'},409);
 if(a.owner_id)return a.owner_id===u.user_id?json({linked:true,alreadyLinked:true}):json({error:'Another account already owns this attorney profile. It cannot be replaced here.'},409);
 if(await db.prepare("SELECT 1 FROM attorney_profiles WHERE owner_id=? AND bar_number<>? AND claimed_at<>''").bind(u.user_id,a.bar_number).first())return json({error:'This account already owns another attorney profile. Use firm access to manage multiple attorneys.'},409);
 const now=new Date().toISOString(),id=JSON.stringify([u.user_id,a.bar_number]),note='Identity and authority verified directly by the administrator. Attorney access assigned to this existing account.';
 const results=await db.batch([
 db.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) SELECT a.bar_number,c.user_id,?,? FROM attorneys a JOIN client_profiles c ON c.user_id=? WHERE a.bar_number=? AND a.name=? AND a.company=? AND a.state=? AND c.email=? AND c.legal_name=? AND NOT EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.owner_id=c.user_id AND p.bar_number<>a.bar_number AND p.claimed_at<>'') ON CONFLICT(bar_number) DO UPDATE SET owner_id=excluded.owner_id,claimed_at=excluded.claimed_at,updated_at=excluded.updated_at WHERE attorney_profiles.owner_id=''").bind(now,now,u.user_id,a.bar_number,a.name,a.company,a.state,u.email,u.legal_name),
 db.prepare("INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,review_note,submitted_at,reviewed_at,reviewed_by) SELECT ?,?,?,?,?,?,'approved',?,?,?,? WHERE changes()>0 ON CONFLICT(id) DO UPDATE SET email=excluded.email,full_name=excluded.full_name,verification=excluded.verification,status='approved',review_note=excluded.review_note,reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,email_token_hash='',email_token_expires=0").bind(id,a.bar_number,u.user_id,u.email,u.legal_name,note,note,now,now,admin.email),
 db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'attorney-access-assigned',?,? WHERE changes()>0").bind(crypto.randomUUID(),admin.email,id,now),
 db.prepare("UPDATE profile_claims SET status='rejected',review_note='Another account was assigned this profile by the administrator.',reviewed_at=?,reviewed_by=?,email_token_hash='',email_token_expires=0 WHERE bar_number=? AND id<>? AND status='pending' AND changes()>0").bind(now,admin.email,a.bar_number,id)
 ]);
 if(!results[0].meta.changes)return json({error:'Access or account details changed. Reload before linking.'},409);
 return json({linked:true});
 }catch{return json({error:'Unable to link this account. Reload and try again.'},503);}}
