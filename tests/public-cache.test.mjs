import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('worker/public-cache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Request,Response,console});
const {publicCachePolicy,cachedPublicResponse}=exports;
const request=(path,options)=>new Request('https://www.lawvetter.com'+path,options);
function setup(){const entries=new Map(),pending=[];let calls=0;return {entries,pending,cache:{async match(key){return entries.get(key.url)?.clone();},async put(key,value){entries.set(key.url,value);}},load:async()=>{calls++;return new Response('public content',{headers:{'Content-Type':'text/html'}});},waitUntil:p=>pending.push(p),calls:()=>calls};}
test('All public directory indexes, filtered pages and charts cache; private and RSC requests bypass',()=>{
 assert.equal(publicCachePolicy(request('/?_lv_reload=123')),null);
 assert.equal(publicCachePolicy(request('/firm?name=Example&_lv_reload=123')),null);
 for(const path of ['/','/?view=charts','/discover','/find-a-lawyer','/firm?name=Example&page=2','/lawyers/example-lv-123','/practice-areas/family-law?city=Atlanta&page=2','/lawyers-in/atlanta/family-law','/awards','/awards/2026-10','/sitemap.xml','/sitemaps/lawyers-1.xml','/api/attorneys?home=1','/api/cities?q=Atlanta'])assert.ok(publicCachePolicy(request(path)),path);
 for(const path of ['/admin','/admin/records','/account','/dashboard','/client-reviews','/reset-password','/?view=shortlist','/api/profiles','/api/shortlist','/api/profile-photo?submission=private','/api/profile-photo?bar=1&submission=private'])assert.equal(publicCachePolicy(request(path)),null,path);
 for(const headers of [{Cookie:'__Host-lawvetter-client=secret'},{Cookie:'__Host-lawvetter-admin=secret'},{Authorization:'Bearer secret'},{RSC:'1'},{'next-router-state-tree':'state'},{'oai-authenticated-user-id':'user'}])assert.equal(publicCachePolicy(request('/',{headers})),null);
 assert.equal(publicCachePolicy(request('/api/attorneys',{method:'POST'})),null);
});
test('Repeat anonymous visits hit the edge; query filters remain separate and private requests cannot hit it',async()=>{
 const s=setup(),get=req=>cachedPublicResponse(req,s.load,s.cache,s.waitUntil);
 const first=await get(request('/practice-areas/family-law?city=Atlanta'));assert.equal(first.headers.get('X-LawVetter-Cache'),'MISS');assert.equal(first.headers.get('Cache-Control'),'no-store, must-revalidate');await Promise.all(s.pending);
 assert.equal((await get(request('/practice-areas/family-law?city=Atlanta'))).headers.get('X-LawVetter-Cache'),'HIT');assert.equal(s.calls(),1);
 await get(request('/practice-areas/family-law?city=Miami'));assert.equal(s.calls(),2);
 await get(request('/practice-areas/family-law?city=Atlanta',{headers:{Cookie:'__Host-lawvetter-client=secret'}}));assert.equal(s.calls(),3);
});
test('Errors, cookies, private data and non-image photo responses never enter the shared cache',async()=>{
 for(const response of [new Response('error',{status:503}),new Response('private',{headers:{'Cache-Control':'private, no-store'}}),new Response('session',{headers:{'Set-Cookie':'test=secret'}}),new Response('varies',{headers:{Vary:'*'}})]){const s=setup();await cachedPublicResponse(request('/'),async()=>response,s.cache,s.waitUntil);await Promise.all(s.pending);assert.equal(s.entries.size,0);}
 const s=setup();await cachedPublicResponse(request('/api/profile-photo?bar=LVexample'),s.load,s.cache,s.waitUntil);assert.equal(s.pending.length,0);
});
test('Public portraits cache and replacement revisions use a new entry',async()=>{
 const s=setup(),load=async()=>new Response('jpeg',{headers:{'Content-Type':'image/jpeg'}});
 const first=await cachedPublicResponse(request('/api/profile-photo?bar=LVexample&v=p1'),load,s.cache,s.waitUntil);assert.match(first.headers.get('Cache-Control'),/max-age=300/);await Promise.all(s.pending);
 assert.equal((await cachedPublicResponse(request('/api/profile-photo?bar=LVexample&v=p1'),load,s.cache,s.waitUntil)).headers.get('X-LawVetter-Cache'),'HIT');
 assert.equal((await cachedPublicResponse(request('/api/profile-photo?bar=LVexample&v=p2'),load,s.cache,s.waitUntil)).headers.get('X-LawVetter-Cache'),'MISS');
});

test('Cache hits restore intended freshness headers and expired entries refresh even if the host retains them',async()=>{
 const s=setup(),req=request('/discover');await cachedPublicResponse(req,s.load,s.cache,s.waitUntil);await Promise.all(s.pending);
 const entry=s.entries.get(req.url);entry.headers.set('Cache-Control','public, max-age=14400');
 const hit=await cachedPublicResponse(req,s.load,s.cache,s.waitUntil);assert.equal(hit.headers.get('X-LawVetter-Cache'),'HIT');assert.equal(hit.headers.get('Cache-Control'),'no-store, must-revalidate');assert.equal(hit.headers.has('X-LawVetter-Cache-Expires'),false);
 entry.headers.set('X-LawVetter-Cache-Expires',String(Date.now()-1));assert.equal((await cachedPublicResponse(req,s.load,s.cache,s.waitUntil)).headers.get('X-LawVetter-Cache'),'MISS');assert.equal(s.calls(),2);
});

test('Only anonymous home and chart documents serve bounded stale HTML while refreshing; Discover and private requests do not',async()=>{
 for(const path of ['/','/?view=charts']){
  const s=setup(),req=request(path);await cachedPublicResponse(req,s.load,s.cache,s.waitUntil);await Promise.all(s.pending);
  const entry=s.entries.get(req.url);entry.headers.set('X-LawVetter-Cache-Expires',String(Date.now()-1000));
  let release;const delayed=new Promise(resolve=>{release=resolve;});
  const stale=await cachedPublicResponse(req,()=>delayed,s.cache,s.waitUntil);
  assert.equal(stale.headers.get('X-LawVetter-Cache'),'STALE');assert.equal(stale.headers.get('Cache-Control'),'no-store, must-revalidate');assert.equal(await stale.text(),'public content');
  release(new Response('updated',{headers:{'Content-Type':'text/html'}}));await Promise.all(s.pending);
  assert.equal(await (await cachedPublicResponse(req,s.load,s.cache,s.waitUntil)).text(),'updated');
  s.entries.get(req.url).headers.set('X-LawVetter-Cache-Expires',String(Date.now()-121000));
  assert.equal((await cachedPublicResponse(req,s.load,s.cache,s.waitUntil)).headers.get('X-LawVetter-Cache'),'MISS');await Promise.all(s.pending);
 }
 assert.equal(publicCachePolicy(request('/discover')).staleSeconds,undefined);
 assert.equal(publicCachePolicy(request('/',{headers:{Cookie:'__Host-lawvetter-client=secret'}})),null);
});

test('A cache miss streams its response without waiting for the cache write',async()=>{
 let release;const pending=[],blocked=new Promise(resolve=>{release=resolve;});
 const cache={match:async()=>null,put:()=>blocked};
 const response=await cachedPublicResponse(request('/'),async()=>new Response('shell',{headers:{'Content-Type':'text/html'}}),cache,p=>pending.push(p));
 assert.equal(await response.text(),'shell');assert.equal(pending.length,1);release();await Promise.all(pending);
});

 test('Profile documents retain anonymous copies for fifteen minutes without extending search or private caching',async()=>{
 for(const path of ['/lawyers/example-lv-123','/firm?name=Example']){
  assert.equal(publicCachePolicy(request(path)).seconds,900);
  const s=setup(),req=request(path);await cachedPublicResponse(req,s.load,s.cache,s.waitUntil);await Promise.all(s.pending);
  const stored=s.entries.get(req.url);assert.match(stored.headers.get('Cache-Control'),/max-age=900/);
  // A document older than the former one-minute lifetime is still valid.
  stored.headers.set('X-LawVetter-Cache-Expires',String(Date.now()+780000));
  assert.equal((await cachedPublicResponse(req,s.load,s.cache,s.waitUntil)).headers.get('X-LawVetter-Cache'),'HIT');
  stored.headers.set('X-LawVetter-Cache-Expires',String(Date.now()-1));
  assert.equal((await cachedPublicResponse(req,s.load,s.cache,s.waitUntil)).headers.get('X-LawVetter-Cache'),'MISS');
  assert.equal(publicCachePolicy(request(path,{headers:{Cookie:'__Host-lawvetter-client=secret'}})),null);
 }
 assert.equal(publicCachePolicy(request('/discover')).seconds,60);
 assert.equal(publicCachePolicy(request('/api/attorneys?q=Smith')).seconds,60);
});
