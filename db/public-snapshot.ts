// Stores only already-sanitized, anonymous public data, independently of a release.
// Old HTML/JavaScript is never reused across releases.
export type SnapshotStore=Pick<Cache,'match'|'put'>;
export function publicSnapshot<T>(load:()=>Promise<T>,cache:()=>Promise<SnapshotStore|undefined>,key:()=>string,freshMs=120000,maxAgeMs=86400000,schedule?:(work:Promise<unknown>)=>void){
 let failure:unknown,pending:Promise<T>|undefined,pendingKey='',opening:Promise<void>|undefined,retryAfter=0,retryKey='',last:{key:string;at:number;value:T}|undefined;
 return async function read():Promise<T>{
  const id=key(),usable=()=>last?.key===id&&Date.now()-last.at<maxAgeMs;
  if(pending&&pendingKey!==id){await pending.catch(()=>{});return read();}
  if(usable()&&(Date.now()-last!.at<freshMs||(retryKey===id&&Date.now()<retryAfter)))return last!.value;
  let store:SnapshotStore|undefined;
  if(!usable()){
   if(!opening){
    opening=(async()=>{try{
     store=await cache();const hit=await store?.match(new Request(id));
     if(hit){const saved=await hit.json() as {at:number;value:T};if(Number.isFinite(saved.at)&&Date.now()-saved.at>=0&&Date.now()-saved.at<maxAgeMs)last={...saved,key:id};}
    }catch(error){console.warn('Public snapshot read unavailable',error);}})().finally(()=>{opening=undefined;});
    // Keep cold snapshot reads alive if the initiating browser disconnects.
    if(schedule)schedule(opening);
   }
   await opening;
   if(usable()&&Date.now()-last!.at<freshMs)return last!.value;
  }
  if(retryKey===id&&Date.now()<retryAfter){if(usable())return last!.value;throw failure;}
  if(!pending){
   pendingKey=id;
   pending=(async()=>{
    try{
     const value=await load();last={key:id,at:Date.now(),value};retryAfter=0;
     const saved={at:last.at,value};
     const write=(async()=>{try{const target=store||await cache();await target?.put(new Request(id),Response.json(saved,{headers:{'Cache-Control':`public, max-age=${Math.ceil(maxAgeMs/1000)}`}}));}catch(error){console.warn('Public snapshot write unavailable',error);}})();
     if(schedule)schedule(write);else await write;
     return value;
    }catch(error){failure=error;retryKey=id;retryAfter=Date.now()+30000;if(usable()){console.warn('Serving last successful public snapshot',error);return last!.value;}throw error;}
   })().finally(()=>{pending=undefined;});
   if(schedule)schedule(pending.catch(()=>{}));
  }
  // Stale data returns immediately; waitUntil keeps its one coalesced refresh alive.
  if(schedule&&usable())return last!.value;
  return pending;
 };
}
