import {env} from 'cloudflare:workers';
import {rawDb} from '../../../db/raw';
import {profileIdentity,sameOrigin} from '../../../db/profile-access';
export async function GET(request:Request){
 try{const bar=new URL(request.url).searchParams.get('bar');const row=await rawDb().prepare('SELECT photo_key FROM attorney_profiles WHERE bar_number=?').bind(bar||'').first<{photo_key:string}>();if(!row?.photo_key)return new Response('Not found',{status:404});const file=await env.PROFILE_PHOTOS.get(row.photo_key);if(!file)return new Response('Not found',{status:404});return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'image/jpeg','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});}catch(error){console.error('Photo read failed',error);return new Response('Photo unavailable',{status:503});}
}
export async function POST(request:Request){
 const {user}=profileIdentity(request);if(!user)return Response.json({error:'Sign in to upload a photo.'},{status:401});if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
 try{
  const reader=request.body?.getReader();if(!reader)return Response.json({error:'Photo required.'},{status:400});
  let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4*1024*1024){await reader.cancel();return Response.json({error:'Upload a JPEG or PNG photo smaller than 3 MB.'},{status:413});}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData(),bar=String(form.get('bar')||''),photo=form.get('photo');
  if(!(photo instanceof File)||photo.size>3*1024*1024||photo.size<24)return Response.json({error:'Upload a JPEG or PNG photo smaller than 3 MB.'},{status:400});
  const db=rawDb(),owner=await db.prepare('SELECT photo_key FROM attorney_profiles WHERE bar_number=? AND owner_id=?').bind(bar,user).first<{photo_key:string}>();if(!owner)return Response.json({error:'Only the approved profile owner can upload a photo.'},{status:403});
  const buffer=await photo.arrayBuffer(),head=new Uint8Array(buffer);const png=[137,80,78,71,13,10,26,10].every((n,i)=>head[i]===n),jpeg=head[0]===255&&head[1]===216&&head[2]===255;
  if(!png&&!jpeg)return Response.json({error:'Only JPEG and PNG photos are accepted.'},{status:400});
  const key='attorneys/'+bar+'/'+crypto.randomUUID()+(png?'.png':'.jpg');await env.PROFILE_PHOTOS.put(key,buffer,{httpMetadata:{contentType:png?'image/png':'image/jpeg'}});
  const result=await db.prepare('UPDATE attorney_profiles SET photo_key=?,updated_at=? WHERE bar_number=? AND owner_id=?').bind(key,new Date().toISOString(),bar,user).run();
  if(!result.meta.changes){await env.PROFILE_PHOTOS.delete(key);return Response.json({error:'Profile ownership changed. Please reload.'},{status:409});}
  return Response.json({photoUrl:'/api/profile-photo?bar='+encodeURIComponent(bar)+'&v='+encodeURIComponent(key)});
 }catch(error){console.error('Photo upload failed',error);return Response.json({error:'Photo could not be uploaded. Please try again.'},{status:503});}
}
