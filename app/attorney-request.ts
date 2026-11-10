import {readDeadline} from './read-json';
export async function requestAttorneyData<T>(parameters: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
 const unavailable='Attorney records could not load. Please try again.';
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  try {
   return await readDeadline((async()=>{
   const response=await fetch(attempt===0?'/api/attorneys':'/api/attorneys?'+new URLSearchParams(Object.entries(parameters).map(([key,value])=>[key,String(value)])),{
    method:attempt===0?'POST':'GET',credentials:'include',redirect:'error',cache:'no-store',
    headers:attempt===0?{Accept:'application/json','Content-Type':'application/json'}:{Accept:'application/json'},
    ...(attempt===0?{body:JSON.stringify(parameters)}:{}),signal:controller.signal,
   });
   if(response.status===401||response.status===403)throw new Error('Your session needs to be refreshed. Reopen LawVetter to continue.');
   if(!response.headers.get('Content-Type')?.includes('application/json')){if(attempt===0)throw new TypeError('Invalid data response.');throw new Error('Your session needs to be refreshed. Reopen LawVetter to continue.');}
   const data=await response.json() as T & {error?:string};
   if(!response.ok){if(attempt===0&&response.status>=500)throw new TypeError('Temporarily unavailable.');throw new Error(data.error||unavailable);}
   return data;
   })(),12000,()=>controller.abort());
  }catch(error){
   if(signal?.aborted||(error instanceof Error&&error.name==='AbortError'))throw error;
   // A read-only retry recovers transient network/redirect failures without recording duplicate searches.
   if(attempt===0&&(error instanceof TypeError||error instanceof Error&&error.message==='Read timed out.')){await new Promise(resolve=>setTimeout(resolve,600+Math.floor(Math.random()*400)));if(signal?.aborted)throw new DOMException('Request cancelled.','AbortError');continue;}
   if(error instanceof TypeError)throw new Error(unavailable);
   if(error instanceof Error&&error.message==='Read timed out.')throw new Error(unavailable);
   throw error;
  }finally{signal?.removeEventListener('abort',cancel);}
 }
 throw new Error(unavailable);
}
