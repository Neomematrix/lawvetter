import {env} from 'cloudflare:workers';
import {adminIdentity} from '../../../db/admin-auth';
import {rawDb} from '../../../db/raw';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams,proposal=params.get('proposal'),firm=params.get('firm');let key='';
  if(proposal){
   if(!await adminIdentity(request))return new Response('Not found',{status:404});
   const row=await rawDb().prepare("SELECT original,proposed FROM enrichment_proposals WHERE id=? AND kind IN ('photo','banner')").bind(proposal).first<{original:string;proposed:string}>();
   if(!row)return new Response('Not found',{status:404});key=params.get('version')==='before'?row.original:row.proposed;
  }else if(firm){const row=await rawDb().prepare('SELECT banner_key FROM enrichment_firm_assets WHERE firm_name=?').bind(firm).first<{banner_key:string}>();key=row?.banner_key||'';}
  if(!key)return new Response('Not found',{status:404});
  if(params.get('size')==='mobile'&&(!proposal||params.get('version')!=='before')){const variant=await rawDb().prepare('SELECT mobile_key FROM enrichment_image_variants WHERE desktop_key=?').bind(key).first<{mobile_key:string}>();if(variant)key=variant.mobile_key;}
  const object=await env.PROFILE_PHOTOS.get(key);if(!object)return new Response('Not found',{status:404});
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/webp','Cache-Control':proposal?'private, no-store':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Image unavailable',{status:503});}
}
