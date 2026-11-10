import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('worker/site-assets.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Request,Response,URL});
test('Live asset endpoint fetches the exact compiled file with the correct content type',async()=>{
 let fetched;
 const response=await exports.siteAssetResponse(new Request('https://www.lawvetter.com/api/site-assets/release/index.css?v=1'),{fetch:async req=>{fetched=req;return new Response('body{}',{headers:{'Content-Type':'text/css'}});}});
 assert.equal(fetched.url,'https://www.lawvetter.com/assets/release/index.css?v=1');
 assert.equal(response.headers.get('content-type'),'text/css');
 assert.equal(await response.text(),'body{}');
});
test('Other APIs and mutations are not handled as public assets',async()=>{
 for(const request of [new Request('https://www.lawvetter.com/api/admin'),new Request('https://www.lawvetter.com/api/site-assets/file.js',{method:'POST'})])assert.equal(await exports.siteAssetResponse(request,{fetch(){throw Error('unexpected asset fetch');}}),null);
});
test('Missing assets are never cached as reusable failed module responses',async()=>{
 const response=await exports.siteAssetResponse(new Request('https://www.lawvetter.com/api/site-assets/release/missing.js'),{fetch:async()=>new Response('missing',{status:404,headers:{'Cache-Control':'public, max-age=3600'}})});
 assert.equal(response.status,404);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('CDN-Cache-Control'),'no-store');
});
test('Release-specific API route serves its exact versioned asset',async()=>{
 let fetched;
 const release='11111111-2222-3333-4444-555555555555';
 const response=await exports.siteAssetResponse(new Request('https://www.lawvetter.com/api/lv-assets-'+release+'/entry.js'),{fetch:async req=>{fetched=req;return new Response('export {}',{headers:{'Content-Type':'text/javascript'}});}});
 assert.equal(fetched.url,'https://www.lawvetter.com/assets/'+release+'/entry.js');
 assert.equal(response.status,200);
});

test('Only successful release-addressed assets receive immutable browser caching',async()=>{
 const release='11111111-2222-3333-4444-555555555555';
 const fetchAsset=async(path,status=200,headers={})=>exports.siteAssetResponse(new Request('https://www.lawvetter.com'+path),{fetch:async()=>new Response('asset',{status,headers:{'Content-Type':'text/javascript',...headers}})});
 const current=await fetchAsset('/api/lv-assets-'+release+'/entry.js');
 assert.equal(current.headers.get('Cache-Control'),'public, max-age=31536000, immutable');
 assert.equal(await current.text(),'asset');
 for(const [path,headers]of [
  ['/api/site-assets/entry.js',{}],
  ['/api/lv-assets-'+release+'/entry.js',{'Set-Cookie':'private=session'}],
  ['/api/lv-assets-'+release+'/entry.js',{'Content-Type':'text/html'}],
 ])assert.notEqual((await fetchAsset(path,200,headers)).headers.get('Cache-Control'),'public, max-age=31536000, immutable');
 assert.equal((await fetchAsset('/api/lv-assets-'+release+'/missing.js',404)).headers.get('Cache-Control'),'no-store');
});
