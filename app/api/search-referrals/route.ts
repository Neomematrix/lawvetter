import {rawDb} from '../../../db/raw';
import {profileIdentity} from '../../../db/profile-access';
import {viewAsToken} from '../../../db/view-as-cookie';
import {allowDirectoryAttempt} from '../../../db/directory-protection';
import {visitorPattern} from '../../../db/inquiry-metrics';
import {searchEngine,referralBar,ensureReferrals} from '../../../db/search-referrals';
import {digest} from '../../../db/client-auth';
import {firmKey} from '../attorneys/firm';
import {firmRecord} from '../../../db/firm-access';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403,headers});
 if(/bot|crawler|spider|headless/i.test(request.headers.get('user-agent')||'')||viewAsToken(request)||(await profileIdentity(request)).admin)return new Response(null,{status:204,headers});
 try{
  const text=await request.text();if(text.length>4096)return new Response(null,{status:413,headers});
  const body=JSON.parse(text);if(!body||!visitorPattern.test(body.visitorId||'')||typeof body.referrer!=='string'||typeof body.landing!=='string')return new Response(null,{status:400,headers});
  const source=searchEngine(body.referrer);if(!source)return new Response(null,{status:204,headers});
  const landing=new URL(body.landing,request.url),origin=new URL(request.url);
  if(landing.origin!==origin.origin&&!(landing.protocol==='https:'&&['lawvetter.com','www.lawvetter.com'].includes(landing.hostname)))return new Response(null,{status:400,headers});
  if(!await allowDirectoryAttempt(request,'search-referral',120))return new Response(null,{status:429,headers});
  const db=rawDb();await ensureReferrals(db);
  const reference=referralBar(landing.pathname+landing.search);
  const attorney=reference?await db.prepare(/^LV[0-9a-f]{32}$/.test(reference)?'SELECT bar_number FROM attorneys WHERE public_id=?':'SELECT bar_number FROM attorneys WHERE bar_number=?').bind(reference.startsWith('LV')&&/^LV[0-9a-f]{32}$/.test(reference)?reference.slice(2):reference).first<{bar_number:string}>():null;
  const bar=attorney?.bar_number||'',now=new Date().toISOString(),key=digest([body.visitorId,now.slice(0,10),source,bar].join(':'));
  await db.prepare('INSERT INTO search_referral_visits(event_key,source,bar_number,created_at) VALUES(?,?,?,?) ON CONFLICT(event_key) DO NOTHING').bind(key,source,bar,now).run();
  if(source==='google'&&landing.pathname==='/firm'){
   const target=firmKey(landing.searchParams.get('name')||''),firm=target?await firmRecord(target):null;
   if(firm){const event=digest([body.visitorId,now.slice(0,10),'google-firm',firm.key].join(':'));await db.prepare('INSERT OR IGNORE INTO google_firm_arrivals(event_key,firm_key,firm_name,created_at) VALUES(?,?,?,?)').bind(event,firm.key,firm.name,now).run();}
  }
  return new Response(null,{status:204,headers});
 }catch{return new Response(null,{status:503,headers});}
}
