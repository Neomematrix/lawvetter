import {readDeadline} from '../app/read-json';
// Calendar-day cadence, anchored November 10, 2026 at 01:00 America/New_York.
// Date arithmetic uses local calendar dates, so daylight saving cannot shift it.
export function rankingSlot(now=Date.now()):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
 const part=(name:string)=>Number(parts.find(p=>p.type===name)!.value);
 const day=Date.UTC(part('year'),part('month')-1,part('day'))/86400000-(part('hour')<1?1:0);
 const anchor=Date.UTC(2026,10,10)/86400000;
 return new Date((anchor+Math.floor((day-anchor)/3)*3)*86400000).toISOString().slice(0,10);
}
export const rankingSnapshotKey='public-snapshots/rankings/latest-v1.json';
const leaseKey='public-snapshots/rankings/refresh-lease-v1';
type Saved<T>={at:number;slot:string;value:T};
export function rankingSnapshot<T>(bucket:R2Bucket,load:()=>Promise<T>,schedule:(work:Promise<unknown>)=>void,legacy:()=>Promise<Saved<T>|undefined>){
 let last:Saved<T>|undefined,checked=0,retryAfter=0,pending:Promise<T>|undefined,opening:Promise<void>|undefined;
 const readSaved=async()=>{
  const object=await readDeadline(bucket.get(rankingSnapshotKey),2000);
  const saved=object?await object.json<Saved<T>>():undefined;
  if(saved&&Number.isFinite(saved.at)&&saved.value&&typeof saved.slot==='string')last=saved;
  return object;
 };
 return async function read():Promise<T>{
  const slot=rankingSlot();
  if(!checked||Date.now()-checked>=60000){
   if(!opening)opening=(async()=>{try{await readSaved();if(!last)last=await legacy();}catch(error){console.warn('Ranking snapshot read failed',String(error));}finally{checked=Date.now();}})().finally(()=>{opening=undefined;});
   schedule(opening);await opening;
  }
  if(last&&last.slot>=slot)return last.value;
  if(Date.now()<retryAfter){if(last)return last.value;throw Error('Rankings temporarily unavailable');}
  if(!pending){
   pending=(async()=>{
    // Fail closed if storage/locking is unavailable: never fall back to an
    // uncoordinated database scan on every request.
    const lease=await readDeadline(bucket.head(leaseKey),2000);
    if(lease&&Number(lease.customMetadata?.expires)>Date.now())throw Error('Ranking refresh already scheduled');
    const owned=await readDeadline(bucket.put(leaseKey,crypto.randomUUID(),{onlyIf:lease?{etagMatches:lease.etag}:{etagDoesNotMatch:'*'},customMetadata:{expires:String(Date.now()+300000)}}),2000);
    if(!owned)throw Error('Ranking refresh already running');
    const previous=await readSaved();
    if(last&&last.slot>=slot)return last.value;
    const value=await readDeadline(load(),13000);
    const saved:Saved<T>={at:Date.now(),slot,value};
    // Atomic durable replacement; a failed calculation/write keeps last good.
    const written=await readDeadline(bucket.put(rankingSnapshotKey,JSON.stringify(saved),{onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}}),3000);
    if(!written)throw Error('Ranking snapshot changed during refresh');
    last=saved;checked=Date.now();return value;
   })().catch(error=>{retryAfter=Date.now()+60000;console.warn('Keeping last successful rankings',String(error));if(last)return last.value;throw error;}).finally(()=>{pending=undefined;});
   schedule(pending.catch(()=>{}));
  }
  if(last)return last.value;
  return pending;
 };
}
