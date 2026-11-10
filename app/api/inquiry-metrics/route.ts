import {rawDb} from '../../../db/raw';
import {visitorStatement} from '../../../db/inquiry-metrics';
import {profileIdentity} from '../../../db/profile-access';
import {allowDirectoryAttempt} from '../../../db/directory-protection';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 if((await profileIdentity(request)).admin||/bot|crawler|spider/i.test(request.headers.get('user-agent')||''))return new Response(null,{status:204});
 try{const body=await request.text();if(body.length>200)return new Response(null,{status:413});if(!await allowDirectoryAttempt(request,'inquiry-visit',120))return new Response(null,{status:429});const visitorId=JSON.parse(body).visitorId,statement=visitorStatement(visitorId);if(!statement)return new Response(null,{status:400});const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());await rawDb().batch([statement,rawDb().prepare('INSERT INTO site_visits(key,visitor,day) VALUES(?,?,?) ON CONFLICT(key) DO NOTHING').bind(day+':'+visitorId,visitorId,day)]);return new Response(null,{status:204});}catch{return new Response(null,{status:503});}
}
