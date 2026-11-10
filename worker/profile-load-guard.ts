// Admission control applies only after an anonymous profile cache miss. Cache
// hits remain unlimited. State is bounded and local to each Worker isolate.
export function createProfileLoadGuard(limit=8,perMinute=30){
 let active=0;
 const clients=new Map<string,{count:number;until:number}>();
 return async function guard(request:Request,load:()=>Promise<Response>){
  const url=new URL(request.url);
  if(request.method!=='GET'||!/^\/lawyers\/[^/]+\/?$/.test(url.pathname)||request.headers.has('authorization')||request.headers.get('cookie')?.includes('__Host-lawvetter-'))return load();
  const now=Date.now(),ip=request.headers.get('cf-connecting-ip');
  const busy=()=>new Response('Please wait a moment and reload this profile.',{status:429,headers:{'Retry-After':'10','Cache-Control':'private, no-store','Content-Type':'text/plain; charset=utf-8'}});
  if(active>=limit){console.warn('Profile load admission deferred');return busy();}
  if(ip){
   for(const [key,value] of clients)if(value.until<=now)clients.delete(key);
   let client=clients.get(ip);
   if(client&&client.count>=perMinute)return busy();
   if(!client){if(clients.size>=2048)clients.delete(clients.keys().next().value!);client={count:0,until:now+60000};clients.set(ip,client);}
   client.count++;
  }
  active++;
  try{return await load();}finally{active--;}
 };
}
export const guardProfileLoad=createProfileLoadGuard();
