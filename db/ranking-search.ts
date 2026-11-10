import {rawDb} from './raw';
import {digest,clientIdentity} from './client-auth';
import {allowDirectoryAttempt} from './directory-protection';
export async function allowRankedSearch(request:Request,target:string,eventId:string){
 if(/bot|crawler|spider/i.test(request.headers.get('user-agent')||''))return false;
 const db=rawDb();if(await db.prepare('SELECT event_id FROM attorney_search_events WHERE event_id=? UNION ALL SELECT event_id FROM firm_search_events WHERE event_id=? LIMIT 1').bind(eventId,eventId).first())return false;
 if(!await allowDirectoryAttempt(request,'ranking-search',120))return false;
 const client=await clientIdentity(request),identity=client?'account:'+client.user:'network:'+(request.headers.get('cf-connecting-ip')||'unknown'),now=Date.now();
 const key=digest('ranking-daily:'+new Date(now).toISOString().slice(0,10)+':'+identity+':'+target);
 // An authenticated account or anonymous network contributes once per target each UTC day.
 const result=await db.prepare('INSERT OR IGNORE INTO client_auth_limits(key,count,expires_at) VALUES(?,1,?)').bind(key,now+86400000).run();return !!result.meta.changes;
}
