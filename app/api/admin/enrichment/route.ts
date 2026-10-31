import {env} from 'cloudflare:workers';
import {adminIdentity} from '../../../../db/admin-auth';
import {rawDb} from '../../../../db/raw';
import {advanceScan,dashboard,decide,startScan} from '../../../../lib/enrichment/engine.mjs';
import {boundedText} from '../../../../lib/enrichment/sources.mjs';
import {researchDb} from '../../../../lib/enrichment/research-db.mjs';
import {inspectImages,stageImage} from '../../../../lib/enrichment/images.mjs';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 if(!await adminIdentity(request))return json({error:'Owner sign-in required'},403);
 try{return json(await dashboard(rawDb(),Object.fromEntries(new URL(request.url).searchParams)));}
 catch{return json({error:'Enrichment tables unavailable. Apply the reviewed migration in staging first.'},503);}
}
export async function POST(request:Request){
 const owner=await adminIdentity(request);if(!owner)return json({error:'Owner sign-in required'},403);
 // Strict origin is required for this new mutation surface; cookies alone are insufficient.
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin'},403);
 try{
  const db=rawDb();
  if((request.headers.get('content-type')||'').startsWith('multipart/form-data')){
   if(Number(request.headers.get('content-length')||0)>4*1024*1024)return json({error:'Image too large'},413);
   const reader=request.body?.getReader();if(!reader)return json({error:'Image required'},400);
   const chunks:Uint8Array[]=[];let size=0;
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4*1024*1024){await reader.cancel();return json({error:'Image too large'},413);}chunks.push(part.value);}
   const bytesAll=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytesAll.set(chunk,offset);offset+=chunk.length;}
   const form=await new Response(bytesAll,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();
   const id=String(form.get('id')||''),row=await db.prepare("SELECT * FROM enrichment_proposals WHERE id=? AND kind IN ('photo','banner') AND status IN ('pending','conflict','deferred')").bind(id).first<Record<string,string>>();
   if(!row)return json({error:'Image review task not found'},404);
   const file=form.get('image');let bytes:Uint8Array;
   if(file instanceof File&&file.size)bytes=new Uint8Array(await file.arrayBuffer());
   else if(row.kind==='photo'&&row.original){const original=await env.PROFILE_PHOTOS.get(row.original);if(!original||original.size>3*1024*1024)throw Error('Original unavailable');bytes=new Uint8Array(await original.arrayBuffer());}
   else throw Error('Supply an authorized JPEG or PNG original');
   const binding=(env as unknown as {IMAGES?:Parameters<typeof stageImage>[2]}).IMAGES;if(!binding)return json({error:'Cloudflare IMAGES binding is required to prepare variants'},503);
   const identityNote=String(form.get('identityNote')||'');if(identityNote.length<20)throw Error('Record how the face or logo was matched to this attorney or firm');
   return json(await stageImage(db,env.PROFILE_PHOTOS,binding,{entity:row.entity,entityId:row.entity_id,name:row.name,state:row.state,kind:row.kind,field:row.field,original:row.original,baseIdentity:row.base_identity,identityConfirmed:form.get('identityConfirmed')==='true',identityNote,rights:String(form.get('rights')||''),sourceUrl:String(form.get('sourceUrl')||'')},bytes));
  }
  const text=await boundedText(request,10000);if(text.length>10000)return json({error:'Request too large'},413);
  const body=JSON.parse(text);
  if(body.action==='scan')return json({scanId:await startScan(db,owner.user)},202);
  if(body.action==='advance'){
   if((env as unknown as {ENRICHMENT_SOURCE_ACCESS?:string}).ENRICHMENT_SOURCE_ACCESS!=='enabled')return json({error:'Official source access is disabled. Configure ENRICHMENT_SOURCE_ACCESS in staging after reviewing source policy.'},409);
   return json(await advanceScan(db,{inspectImage:(common:Parameters<typeof inspectImages>[2])=>inspectImages(researchDb(db),env.PROFILE_PHOTOS,common)}));
  }
  if(!Array.isArray(body.ids)||body.ids.some((id:unknown)=>typeof id!=='string'||id.length>100))return json({error:'Invalid proposal IDs'},400);
  return json(await decide(db,body.ids,body.action,owner.user,String(body.note||'')));
 }catch(error){const message=error instanceof Error?error.message:'Enrichment operation failed';return json({error:message.includes('D1_')?'Decision blocked: current values, ownership, or source evidence changed. Reload before reviewing again.':message},409);}
}
