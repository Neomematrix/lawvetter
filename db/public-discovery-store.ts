import * as runtime from 'cloudflare:workers';
import {readDeadline} from '../app/read-json';
import type {SnapshotStore} from './public-snapshot';
// Cache API entries are local and evictable. R2 keeps the last successful public
// JSON available across locations, cold starts and deployments. Never store HTML.
export async function discoverySnapshotStore(namespace='discovery'):Promise<SnapshotStore>{
 let edge:Cache|undefined;
 try{if(typeof caches!=='undefined')edge=await readDeadline(caches.open('lawvetter-public-'+namespace+'-v1'),1000);}catch(error){console.warn('Discovery cache unavailable',error);}
 const bucket=runtime.env.PROFILE_PHOTOS;
 const objectKey=(request:RequestInfo|URL)=>'public-snapshots/'+namespace+'/'+new URL(typeof request==='string'||request instanceof URL?request:request.url).pathname.split('/').pop()+'.json';
 return {
  async match(request){
   try{const hit=await readDeadline(Promise.resolve(edge?.match(request)),1000);if(hit)return hit;}catch(error){console.warn('Discovery cache read unavailable',error);}
   if(!bucket)return undefined;
   const object=await readDeadline(bucket.get(objectKey(request)),2000);
   return object?new Response(object.body,{headers:{'Content-Type':'application/json'}}):undefined;
  },
  async put(request,response){
   const writes:Promise<unknown>[]=[];
   if(edge)writes.push(readDeadline(edge.put(request,response.clone()),2000));
   if(bucket)writes.push(readDeadline(bucket.put(objectKey(request),response.clone().body,{httpMetadata:{contentType:'application/json'}}),3000));
   const results=await Promise.allSettled(writes);
   for(const result of results)if(result.status==='rejected')console.warn('Discovery snapshot write unavailable',result.reason);
  },
 };
}
export function keepDiscoveryRefresh(work:Promise<unknown>){runtime.waitUntil?.(work);}
