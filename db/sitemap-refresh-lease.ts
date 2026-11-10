import {readDeadline} from '../app/read-json';
const leaseKey='public-snapshots/sitemap-refresh-lease-v1';
// Every isolate/region shares this conditional R2 lock. Never queue a burst of
// sitemap scans behind user searches; other callers use their saved XML instead.
export async function withSitemapRefreshLease<T>(bucket:R2Bucket|undefined,load:()=>Promise<T>):Promise<T>{
 if(!bucket)throw Error('Sitemap refresh storage unavailable');
 const existing=await readDeadline(bucket.head(leaseKey),2000);
 if(existing&&Number(existing.customMetadata?.expires)>Date.now())throw Error('Sitemap refresh deferred');
 const owner=crypto.randomUUID();
 const lease=await readDeadline(bucket.put(leaseKey,owner,{
  onlyIf:existing?{etagMatches:existing.etag}:{etagDoesNotMatch:'*'},
  customMetadata:{expires:String(Date.now()+45000)}
 }),2000);
 if(!lease)throw Error('Sitemap refresh deferred');
 // A timed-out or failed refresh retains its lease until expiry. This avoids
 // immediate retries while D1 may still be finishing the original query.
 const value=await readDeadline(load(),20000);
 try{
  await readDeadline(bucket.put(leaseKey,owner+':cooldown',{
   onlyIf:{etagMatches:lease.etag},customMetadata:{expires:String(Date.now()+10000)}
  }),2000);
 }catch(error){console.warn('Sitemap refresh lease release unavailable',String(error));}
 return value;
}
