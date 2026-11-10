import {env} from 'cloudflare:workers';
import {adminIdentity} from '../../../../db/admin-auth';
import {removeNonactiveBatch} from '../../../../db/nonactive-cleanup';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 const settings=env as unknown as {NONACTIVE_CLEANUP_KEY?:string;NONACTIVE_CLEANUP_EXPIRES?:string;CLAIM_ADMIN_EMAIL?:string};
 const key=settings.NONACTIVE_CLEANUP_KEY,expires=Number(settings.NONACTIVE_CLEANUP_EXPIRES),authorized=!!key&&key.length>=64&&expires>Date.now()&&expires<Date.now()+3600000&&request.headers.get('authorization')==='Bearer '+key;
 const identity=authorized?{email:settings.CLAIM_ADMIN_EMAIL||'site-owner'}:await adminIdentity(request);
 if(!identity)return json({error:'Sign in as administrator.'},401);
 if(request.headers.get('content-length')&&Number(request.headers.get('content-length'))>200)return json({error:'Request too large.'},413);
 try{const raw=await request.text();if(raw.length>200)return json({error:'Request too large.'},413);const confirmation=JSON.parse(raw).confirm;if(!['REMOVE INACTIVE ATTORNEYS','REMOVE EMERITUS ATTORNEYS'].includes(confirmation))return json({error:'Confirmation required.'},400);return json(await removeNonactiveBatch(identity.email,confirmation==='REMOVE EMERITUS ATTORNEYS'?'emeritus':'inactive'));}catch{return json({error:'Cleanup failed. No partial batch is committed.'},503);}
}
