// Explicitly public read routes only. Full URLs keep filters and pagination separate.
export function publicCachePolicy(request:Request):{seconds:number;image:boolean;staleSeconds?:number}|null{
 const url=new URL(request.url),path=url.pathname;
 if(request.method!=='GET'||request.headers.has('authorization')||request.headers.has('range'))return null;
 if(url.searchParams.has('_lv_reload'))return null;
 if(request.headers.get('rsc')==='1'||request.headers.has('next-router-state-tree')||request.headers.has('next-router-prefetch')||request.headers.get('accept')?.includes('text/x-component')||url.searchParams.has('_rsc'))return null;
 if([...request.headers.keys()].some(key=>/^oai-authenticated-|^x-oai-/.test(key)))return null;
 const image=path==='/api/profile-photo'&&!!url.searchParams.get('bar')&&!url.searchParams.has('submission')||path==='/api/firm-logo';
 // Public image GETs do not inspect sessions. Pages with sessions always render fresh.
 if(!image&&request.headers.get('cookie')?.split(';').some(cookie=>/^__Host-lawvetter-/.test(cookie.trim())))return null;
 if(image)return {seconds:300,image:true};
 if(url.searchParams.get('view')==='shortlist')return null;
 // Anonymous landing documents can revalidate in the background for at most
 // two additional minutes. Discover keeps its original freshness behavior.
 if(path==='/'&&(!url.searchParams.get('view')||url.searchParams.get('view')==='charts'))return {seconds:60,image:false,staleSeconds:120};
 // Profile documents change less often than search results. Keep a bounded
 // 15-minute lifetime; session requests and explicit reloads bypass above.
 if(path==='/firm'||/^\/lawyers\/[^/]+\/?$/.test(path))return {seconds:900,image:false};
 if(path==='/api/attorneys'||path==='/api/cities')return {seconds:60,image:false};
 if(['/','/discover','/find-a-lawyer','/firm','/awards'].includes(path)||/^\/(?:practice-areas\/[^/]+|lawyers\/[^/]+|lawyers-in\/[^/]+\/[^/]+|awards\/\d{4}-\d{2})\/?$/.test(path))return {seconds:60,image:false};
 if(['/about','/contact','/how-lawvetter-works','/privacy','/disclaimer','/robots.txt','/sitemap.xml'].includes(path)||/^\/sitemaps\/[^/]+$/.test(path))return {seconds:300,image:false};
 return null;
}
export async function cachedPublicResponse(request:Request,load:()=>Promise<Response>,cache:Cache|undefined,waitUntil:(promise:Promise<unknown>)=>void){
 const candidate=publicCachePolicy(request);
 if(!candidate)return load();
 const policy=candidate;
 const html=!new URL(request.url).pathname.startsWith('/api/')&&!/\.(?:xml|txt)$/.test(new URL(request.url).pathname);
 // HTML contains release-specific module URLs. Only the release-scoped Worker
 // cache may retain it; browsers and upstream CDNs must request fresh documents.
 const key=new Request(request.url),cacheControl=html?'no-store, must-revalidate':`public, max-age=${policy.image?300:0}, s-maxage=${policy.seconds}`;
 async function refresh(background=false){
 const response=await load(),type=response.headers.get('content-type')||'',control=response.headers.get('cache-control')||'';
 if(new URL(request.url).pathname.startsWith('/api/')&&!policy.image&&!type.includes('application/json'))return response;
 if(response.status!==200||response.headers.has('set-cookie')||/private/i.test(control)||response.headers.get('vary')==='*'||(policy.image&&!type.startsWith('image/')))return response;
 const result=new Response(response.body,response);
 result.headers.set('Cache-Control',cacheControl);
 result.headers.set('X-LawVetter-Cache','MISS');
 if(cache){const stored=result.clone();stored.headers.set('Cache-Control',`public, max-age=${policy.seconds+(policy.staleSeconds||0)}`);stored.headers.set('X-LawVetter-Cache-Expires',String(Date.now()+policy.seconds*1000));const put=cache.put(key,stored).catch(error=>console.warn('Public cache write failed',error));if(background)await put;else waitUntil(put);}
 return result;
 }
 if(cache){try{const hit=await cache.match(key),expires=hit&&Number(hit.headers.get('X-LawVetter-Cache-Expires'));
  if(hit&&expires&&expires+(policy.staleSeconds||0)*1000>Date.now()){
   const stale=expires<=Date.now();
   if(stale)waitUntil(refresh(true).then(response=>{void response.body?.cancel().catch(()=>{});}).catch(error=>console.warn('Public background refresh failed',error)));
   const response=new Response(hit.body,hit);response.headers.delete('X-LawVetter-Cache-Expires');response.headers.set('Cache-Control',cacheControl);response.headers.set('X-LawVetter-Cache',stale?'STALE':'HIT');return response;
  }
 }catch(error){console.warn('Public cache read failed',error);}}
 return refresh();
}
