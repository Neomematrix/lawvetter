import {activeMembershipSQL} from '../../../db/active-membership';
import {publicRecords} from '../../../db/public-records';
import {resolveAttorneyReference} from '../../../db/attorney-reference';
import {publicAttorneyColumns} from '../../../db/public-attorney';
import {ownershipVerifiedColumn} from '../../../db/attorney-verification';
import {validAttorneyId} from '../../attorney-identity';
import {rawDb} from '../../../db/raw';
import {clientIdentity} from '../../../db/client-auth';
export async function POST(request:Request){
 const user=(await clientIdentity(request))?.user;
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
 try{
  const data=await request.json() as {action?:string;bar?:string};
  if(!data||!['list','save','remove','clear'].includes(data.action||''))return Response.json({error:'Invalid shortlist request.'},{status:400});
  // A guest checking session state is normal; shortlist changes still require sign-in.
  if(!user){
   if(data.action==='list')return Response.json({signedIn:false,attorneys:[]},{headers:{'Cache-Control':'private, no-store'}});
   return Response.json({error:'Sign in to save and compare attorneys.'},{status:401,headers:{'Cache-Control':'private, no-store'}});
  }
  const db=rawDb();
  if(data.action==='clear')await db.prepare('DELETE FROM shortlist WHERE user_id=?').bind(user).run();
  if(data.action==='save'||data.action==='remove'){
   if(typeof data.bar!=='string'||!validAttorneyId(data.bar))return Response.json({error:'Invalid attorney.'},{status:400});
   data.bar=await resolveAttorneyReference(data.bar);
   const id=JSON.stringify([user,data.bar]);
   if(data.action==='remove')await db.prepare('DELETE FROM shortlist WHERE id=? AND user_id=?').bind(id,user).run();
   else {
    const attorney=await db.prepare('SELECT bar_number FROM attorneys WHERE '+activeMembershipSQL()+' AND bar_number=?').bind(data.bar).first();
    if(!attorney)return Response.json({error:'Attorney not found.'},{status:404});
    const count=await db.prepare('SELECT count(*) AS n FROM shortlist WHERE user_id=?').bind(user).first<{n:number}>();
    if((count?.n||0)>=100)return Response.json({error:'Your shortlist is full. Remove an attorney before adding another.'},{status:400});
    await db.prepare('INSERT OR IGNORE INTO shortlist(id,user_id,bar_number,created_at) VALUES(?,?,?,?)').bind(id,user,data.bar,new Date().toISOString()).run();
   }
  }
  const rows=await db.prepare('SELECT '+publicAttorneyColumns('a')+','+ownershipVerifiedColumn('a')+',p.photo_key,p.practice_areas FROM shortlist s JOIN attorneys a ON a.bar_number=s.bar_number LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE '+activeMembershipSQL('a')+' AND s.user_id=? ORDER BY s.created_at DESC,a.name').bind(user).all();
  return Response.json({signedIn:true,attorneys:await publicRecords(rows.results)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('Shortlist failed',error);return Response.json({error:'Your shortlist could not be updated. Please try again.'},{status:503});}
}
