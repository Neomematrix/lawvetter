// Read-only requests may retry once. Mutations must never use this helper.
export async function readJson<T>(url:string,signal?:AbortSignal):Promise<T>{
 for(let attempt=0;attempt<2;attempt++){
  if(signal?.aborted)throw new Error('Request cancelled.');
  const controller=new AbortController(),cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  try{
   return await readDeadline((async()=>{
    const response=await fetch(url,{cache:'no-store',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
    if(response.status===401||response.status===403)throw new ReadError('Your admin session has expired. Sign in again.',false);
    if(!response.headers.get('content-type')?.includes('application/json'))throw new ReadError('The server did not return the requested data. Please try again.',true);
    const data=await response.json() as T&{error?:string};
    if(!response.ok)throw new ReadError(data.error||'Unable to load this information. Please try again.',response.status>=500);
    return data;
   })(),12000,()=>controller.abort());
  }catch(error){
   if(signal?.aborted)throw error;
   if(attempt===0&&(!(error instanceof ReadError)||error.retry))continue;
   throw new Error(error instanceof ReadError?error.message:'This is taking longer than expected. Please try again.');
  }finally{signal?.removeEventListener('abort',cancel);}
 }
 throw new Error('Unable to load this information. Please try again.');
}
class ReadError extends Error{constructor(message:string,public retry:boolean){super(message);}}
export function readDeadline<T>(work:Promise<T>,milliseconds:number,onTimeout?:()=>void):Promise<T>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{reject(new Error('Read timed out.'));onTimeout?.();},milliseconds);
  work.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
 });
}
