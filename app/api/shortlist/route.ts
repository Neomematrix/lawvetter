import {rawDb} from '../../../db/raw';
export async function POST(request:Request){
 const user=request.headers.get('oai-authenticated-user-id');
 if(!user)return Response.json({error:'Sign in to save and compare attorneys.'},{status:401});
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
 try{
  const data=await request.json() as {action?:string;bar?:string};
  if(!data||!['list','save','remove'].includes(data.action||''))return Response.json({error:'Invalid shortlist request.'},{status:400});
  const db=rawDb();
  if(data.action!=='list'){
   if(typeof data.bar!=='string'||!/^\d{1,20}$/.test(data.bar))return Response.json({error:'Invalid attorney.'},{status:400});
   const id=JSON.stringify([user,data.bar]);
   if(data.action==='remove')await db.prepare('DELETE FROM shortlist WHERE id=? AND user_id=?').bind(id,user).run();
   else {
    const attorney=await db.prepare('SELECT bar_number FROM attorneys WHERE bar_number=?').bind(data.bar).first();
    if(!attorney)return Response.json({error:'Attorney not found.'},{status:404});
    const count=await db.prepare('SELECT count(*) AS n FROM shortlist WHERE user_id=?').bind(user).first<{n:number}>();
    if((count?.n||0)>=100)return Response.json({error:'Your shortlist is full. Remove an attorney before adding another.'},{status:400});
    await db.prepare('INSERT OR IGNORE INTO shortlist(id,user_id,bar_number,created_at) VALUES(?,?,?,?)').bind(id,user,data.bar,new Date().toISOString()).run();
   }
  }
  const rows=await db.prepare('SELECT a.* FROM shortlist s JOIN attorneys a ON a.bar_number=s.bar_number WHERE s.user_id=? ORDER BY s.created_at DESC,a.name').bind(user).all();
  return Response.json({attorneys:rows.results},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('Shortlist failed',error);return Response.json({error:'Your shortlist could not be updated. Please try again.'},{status:503});}
}
