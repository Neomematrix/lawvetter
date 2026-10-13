import {env} from 'cloudflare:workers';
export async function submissionInput(request:Request){
 const reader=request.body?.getReader();if(!reader)throw Error('Submission required.');let size=0;const chunks:Uint8Array[]=[];
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4*1024*1024){await reader.cancel();throw Error('Submission is too large. Photos must be smaller than 3 MB.');}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body:string,photo:File|null=null;
 if((request.headers.get('Content-Type')||'').startsWith('multipart/form-data')){const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('Content-Type')!}}).formData();body=String(form.get('data')||'');const file=form.get('photo');if(file instanceof File&&file.size)photo=file;}
 else body=await new Response(bytes).text();
 if(body.length>20000)throw Error('Submission is too large.');
 return {data:JSON.parse(body) as Record<string,unknown>,photo};
}
export async function checkSubmissionPhoto(photo:File|null){
 if(!photo)return null;
 if(photo.size>3*1024*1024||photo.size<24)throw Error('Upload a JPEG or PNG photo smaller than 3 MB.');
 const bytes=new Uint8Array(await photo.arrayBuffer()),png=[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!png&&!jpeg)throw Error('Only JPEG and PNG photos are accepted.');
 return {bytes,contentType:png?'image/png':'image/jpeg',extension:png?'.png':'.jpg'};
}
export async function saveSubmissionPhoto(id:string,photo:Awaited<ReturnType<typeof checkSubmissionPhoto>>){
 if(!photo)return '';const key='submissions/'+id+'/'+crypto.randomUUID()+photo.extension;
 await env.PROFILE_PHOTOS.put(key,photo.bytes,{httpMetadata:{contentType:photo.contentType}});return key;
}
export async function discardSubmissionPhoto(key:string){if(key)await env.PROFILE_PHOTOS.delete(key);}
