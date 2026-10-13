import {clientIdentity} from '../../../../db/client-auth';
import {rawDb} from '../../../../db/raw';
import {profileIdentity} from '../../../../db/profile-access';
import {monthStart} from '../../attorneys/charts';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'}, {user}=(await clientIdentity(request))||(await profileIdentity(request));
 if(!user)return Response.json({error:'Sign in to view your profile analytics.'},{status:401,headers});
 try{const db=rawDb(),now=new Date(),end=now.toISOString(),week=new Date(now.getTime()-7*86400000).toISOString(),month=monthStart(now);
 const rows=await db.prepare(`SELECT p.bar_number,a.name,
 (SELECT count(*) FROM attorney_search_events e WHERE e.bar_number=p.bar_number AND e.created_at>=? AND e.created_at<=?) AS weekly,
 (SELECT count(*) FROM attorney_search_events e WHERE e.bar_number=p.bar_number AND e.created_at>=? AND e.created_at<=?) AS monthly
 FROM attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number WHERE p.owner_id=? ORDER BY a.name`).bind(week,end,month,end,user).all();
 if(!rows.results.length)return Response.json({error:'Claim your attorney profile and wait for approval to access its analytics.'},{status:403,headers});
 return Response.json({profiles:rows.results,monthLabel:new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'long',year:'numeric'}).format(now)},{headers});
 }catch{return Response.json({error:'Analytics are temporarily unavailable. Please try again.'},{status:503,headers});}
}
