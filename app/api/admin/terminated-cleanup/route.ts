import {env} from 'cloudflare:workers';
import {adminIdentity} from '../../../../db/admin-auth';
import {removeTerminatedBatch} from '../../../../db/terminated-cleanup';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 const settings=env as unknown as {TERMINATED_CLEANUP_KEY?:string;TERMINATED_CLEANUP_EXPIRES?:string;CLAIM_ADMIN_EMAIL?:string};
 const key=settings.TERMINATED_CLEANUP_KEY,expires=Number(settings.TERMINATED_CLEANUP_EXPIRES),authorized=!!key&&key.length>=64&&expires>Date.now()&&expires<Date.now()+3600000&&request.headers.get('authorization')==='Bearer '+key;
 const identity=authorized?{email:settings.CLAIM_ADMIN_EMAIL||'site-owner'}:await adminIdentity(request);
 if(!identity)return json({error:'Sign in as administrator.'},401);
 if(request.headers.get('content-length')&&Number(request.headers.get('content-length'))>200)return json({error:'Request too large.'},413);
 try{const raw=await request.text();if(raw.length>200)return json({error:'Request too large.'},413);if(JSON.parse(raw).confirm!=='REMOVE TERMINATED ATTORNEYS')return json({error:'Confirmation required.'},400);return json(await removeTerminatedBatch(identity.email));}catch{return json({error:'Cleanup failed. No partial batch is committed.'},503);}
}
