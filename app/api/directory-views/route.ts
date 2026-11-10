import {rawDb} from '../../../db/raw';
import {profileIdentity} from '../../../db/profile-access';
import {allowDirectoryAttempt} from '../../../db/directory-protection';
import {firmKey} from '../attorneys/firm';
import {firmRecord} from '../../../db/firm-access';
import {googleTraffic} from '../../traffic-source';
import {resolveAttorneyReference} from '../../../db/attorney-reference';
export async function POST(request:Request){const headers={'Cache-Control':'no-store'};try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin.'},{status:403,headers});
 if(/bot|crawler|spider/i.test(request.headers.get('user-agent')||'')||(await profileIdentity(request)).admin)return new Response(null,{status:204,headers});const text=await request.text();if(text.length>2600)return Response.json({error:'Invalid visit.'},{status:400,headers});const data=JSON.parse(text);if(!data||!['firm','attorney'].includes(data.kind)||typeof data.eventId!=='string'||!/^[a-f0-9-]{36}$/i.test(data.eventId)||typeof data.target!=='string'||data.target.length>200)return Response.json({error:'Invalid visit.'},{status:400,headers});if(!await allowDirectoryAttempt(request,'directory-views',300))return new Response(null,{status:429,headers});
 const key=data.kind==='firm'?firmKey(data.target):await resolveAttorneyReference(data.target),db=rawDb();if(data.kind==='firm'?!await firmRecord(key):!await db.prepare('SELECT bar_number FROM attorneys WHERE bar_number=?').bind(key).first())return new Response(null,{status:404,headers});
 await db.prepare('INSERT OR IGNORE INTO directory_page_views(event_id,target_kind,target_key,source,created_at) VALUES(?,?,?,?,?)').bind(data.eventId,data.kind,key,googleTraffic(data.referrer)?'google':'other',new Date().toISOString()).run();return Response.json({recorded:true},{headers});
 }catch{return new Response(null,{status:503,headers});}}
