import {profileViewAnalytics} from '../../../../db/profile-view-analytics';
import {rawDb} from '../../../../db/raw';
import {profileIdentity} from '../../../../db/profile-access';
import {publicReadCache} from '../../../../db/public-read-cache';
import {ensureReferrals,searchAnalyticsPeriod} from '../../../../db/search-referrals';
import {monthStart,discoveryData} from '../../attorneys/charts';
async function loadAnalytics(db:D1Database){
 await ensureReferrals(db);
 const data=await discoveryData(db,true),now=new Date(),end=now.toISOString();
 const week=new Date(now.getTime()-7*86400000).toISOString(),month=monthStart(now);
 // Avoid launching all 18 traffic/view queries in a single database burst.
 const weekly=await searchAnalyticsPeriod(db,week,end);
 const monthly=await searchAnalyticsPeriod(db,month,end);
 const weeklyViews=await profileViewAnalytics(db,week,end);
 const monthlyViews=await profileViewAnalytics(db,month,end);
 return {...data,traffic:{weekly,monthly},profileViews:{weekly:weeklyViews,monthly:monthlyViews}};
}
// Owner-only server memory. Every request must pass fresh authorization before
// reading it; neither the browser nor the public edge cache may store this data.
const readers=new WeakMap<D1Database,()=>ReturnType<typeof loadAnalytics>>();
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  if(!(await profileIdentity(request)).admin)return Response.json({error:'Only the site owner can view search analytics.'},{status:403,headers});
  const db=rawDb();let read=readers.get(db);
  if(!read){read=publicReadCache(()=>loadAnalytics(db),30000);readers.set(db,read);}
  return Response.json(await read(),{headers});
 }catch(error){console.error('Search analytics unavailable',error);return Response.json({error:'Search analytics are temporarily unavailable.'},{status:503,headers});}
}
