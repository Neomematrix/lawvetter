import {notifyAttorney} from '../../../../db/referral-notification';
import {clientIdentity} from '../../../../db/client-auth';
import {rawDb} from '../../../../db/raw';
import {validAttorneyId} from '../../../attorney-identity';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const owned="EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=client_leads.attorney_bar AND p.owner_id=? AND p.claimed_at<>'')";
export async function GET(request:Request){
 try{
  const client=await clientIdentity(request);if(!client)return reply({error:'Log in to view your referrals.'},401);
  const db=rawDb(),params=new URL(request.url).searchParams,bar=params.get('bar')||'',page=Number(params.get('page')||'1');
  if(bar&&!validAttorneyId(bar)||!Number.isInteger(page)||page<1||page>10000)return reply({error:'Invalid referral inbox request.'},400);
  if(bar&&!await db.prepare("SELECT bar_number FROM attorney_profiles WHERE bar_number=? AND owner_id=? AND claimed_at<>''").bind(bar,client.user).first())return reply({error:'You can only view referrals for profiles you manage.'},403);
  const where=owned+(bar?' AND attorney_bar=?':''),args=bar?[client.user,bar]:[client.user];
  const [rows,count]=await Promise.all([
   db.prepare('SELECT id,attorney_bar,attorney_name,name,email,phone,city,practice,summary,contact_method,urgency,status,created_at,attorney_read_at,(SELECT n.status FROM referral_notifications n WHERE n.lead_id=client_leads.id AND (n.owner_id=? OR length(n.owner_id)=0) ORDER BY n.first_attempt DESC LIMIT 1) AS email_alert_status FROM client_leads WHERE '+where+' ORDER BY created_at DESC,id LIMIT 20 OFFSET ?').bind(client.user,...args,(page-1)*20).all(),
   db.prepare("SELECT count(*) AS total,COALESCE(sum(CASE WHEN attorney_read_at IS NULL THEN 1 ELSE 0 END),0) AS unread,COALESCE(sum(CASE WHEN urgency='urgent' AND status NOT IN ('closed','hired') THEN 1 ELSE 0 END),0) AS urgent FROM client_leads WHERE "+where).bind(...args).first<{total:number;unread:number;urgent:number}>()
  ]);
  return reply({referrals:rows.results,metrics:count||{total:0,unread:0,urgent:0},page});
 }catch{return reply({error:'Your referral inbox could not be loaded. Please try again.'},503);}
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'Unsupported request format.'},415);
 try{
  const client=await clientIdentity(request);if(!client)return reply({error:'Log in to manage your referrals.'},401);
  const text=await request.text();if(text.length>2000)return reply({error:'Request too large.'},413);
  let data:{action?:string;id?:string;status?:string};try{data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}catch{return reply({error:'Invalid request.'},400);}
  if(typeof data.id!=='string'||data.id.length>80||!['read','status','notify'].includes(data.action||'')||(data.action==='status'&&!['new','contacted','qualified','hired','closed'].includes(data.status||'')))return reply({error:'Invalid referral update.'},400);
  const now=new Date().toISOString(),db=rawDb();
  if(data.action==='notify'){if(!await db.prepare('SELECT id FROM client_leads WHERE id=? AND '+owned).bind(data.id,client.user).first())return reply({error:'Referral not found.'},404);return reply({saved:true,emailStatus:await notifyAttorney(data.id)});}
  const result=data.action==='read'?await db.prepare('UPDATE client_leads SET attorney_read_at=COALESCE(attorney_read_at,?),updated_at=? WHERE id=? AND '+owned).bind(now,now,data.id,client.user).run():await db.prepare('UPDATE client_leads SET status=?,updated_at=? WHERE id=? AND '+owned).bind(data.status!,now,data.id,client.user).run();
  return result.meta.changes?reply({saved:true}):reply({error:'Referral not found.'},404);
 }catch{return reply({error:'Your referral could not be updated. Please try again.'},503);}
}
