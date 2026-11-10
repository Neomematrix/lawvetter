// Completed public values may be shared; unfinished I/O belongs to one request.
// The Worker installs an AsyncLocalStorage scope. Outside a Worker, one scope
// preserves the existing coalescing behavior for jobs and unit tests.
const defaultScope={};
let requestScope:()=>object=()=>defaultScope;
export function configurePublicReadScope(scope:()=>object){requestScope=scope;}
export function publicReadCache<T>(load:()=>Promise<T>,ttlMs:number,timeoutMs=0){
 let value:T,expires=0,generation=0,sequence=0,accepted=0;
 type Pending={request:Promise<T>;at:number};
 let requests=new WeakMap<object,Pending>();
 function bounded(entry:Pending,scope:object):Promise<T>{
  if(!timeoutMs)return entry.request;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{if(requests.get(scope)===entry)requests.delete(scope);reject(new Error('Public read timed out.'));},Math.max(1,timeoutMs-(Date.now()-entry.at)));
   entry.request.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
 }
 function read():Promise<T>{
  if(Date.now()<expires)return Promise.resolve(value);
  const scope=requestScope();
  const prior=requests.get(scope);
  if(prior&&(!timeoutMs||Date.now()-prior.at<timeoutMs))return bounded(prior,scope);
  const version=generation,order=++sequence;
  const entry:Pending={at:Date.now(),request:undefined as unknown as Promise<T>};
  entry.request=Promise.resolve().then(load).then(result=>{
   if(version===generation&&requests.get(scope)===entry&&order>=accepted){value=result;expires=Date.now()+ttlMs;accepted=order;}
   return result;
  }).finally(()=>{if(requests.get(scope)===entry)requests.delete(scope);});
  requests.set(scope,entry);return bounded(entry,scope);
 }
 return Object.assign(read,{clear(){generation++;expires=0;requests=new WeakMap();}});
}
export async function retryPublicRead<T>(load:()=>Promise<T>):Promise<T>{
 try{return await load();}catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(!/D1.*(?:CPU time limit|reset|busy|overload|temporar)|SQLITE_BUSY/i.test(message))throw error;
  await new Promise(resolve=>setTimeout(resolve,150+Math.floor(Math.random()*150)));
  return load();
 }
}
