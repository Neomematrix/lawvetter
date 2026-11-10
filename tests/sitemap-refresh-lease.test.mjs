import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(){
 let now=1000,stored=null,version=0;
 const bucket={async head(){return stored&&structuredClone(stored);},async put(_key,_value,options){
  const condition=options.onlyIf;
  if(condition.etagDoesNotMatch==='*'&&stored||condition.etagMatches&&stored?.etag!==condition.etagMatches)return null;
  stored={etag:String(++version),customMetadata:options.customMetadata};return structuredClone(stored);
 }};
 function isolate(){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('db/sitemap-refresh-lease.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date:{now:()=>now},crypto:globalThis.crypto,console,require:()=>({readDeadline:p=>p})});return exports.withSitemapRefreshLease;}
 return {bucket,isolate,advance:ms=>{now+=ms;},get:()=>stored};
}
test('simultaneous sitemap refreshes in different isolates permit only one database load',async()=>{
 const x=setup();let calls=0,finish;
 const load=()=>{calls++;return new Promise(r=>finish=r);};
 const first=x.isolate()(x.bucket,load),second=x.isolate()(x.bucket,load);
 await assert.rejects(second,/deferred/);assert.equal(calls,1);finish('<xml/>');assert.equal(await first,'<xml/>');
 await assert.rejects(x.isolate()(x.bucket,load),/deferred/);assert.equal(calls,1);
 x.advance(10001);assert.equal(await x.isolate()(x.bucket,async()=>'<next/>'),'<next/>');
});
test('failed refresh keeps the lease, expires after abandonment, and does not touch D1 without storage',async()=>{
 const x=setup();let calls=0;const fail=async()=>{calls++;throw Error('D1 overloaded');};
 await assert.rejects(x.isolate()(x.bucket,fail),/overloaded/);
 x.advance(30000);await assert.rejects(x.isolate()(x.bucket,fail),/deferred/);assert.equal(calls,1);
 x.advance(15001);assert.equal(await x.isolate()(x.bucket,async()=>'<recovered/>'),'<recovered/>');
 await assert.rejects(x.isolate()(undefined,fail),/storage unavailable/);assert.equal(calls,1);
});
test('a late old refresh cannot release a newer owner lease',async()=>{
 const x=setup();let finish;
 const old=x.isolate()(x.bucket,()=>new Promise(r=>finish=r));
 for(let i=0;i<5;i++)await Promise.resolve();
 x.advance(45001);let finishNew;
 const fresh=x.isolate()(x.bucket,()=>new Promise(r=>finishNew=r));
 for(let i=0;i<5;i++)await Promise.resolve();
 const owner=x.get().etag;finish('<old/>');await old;assert.equal(x.get().etag,owner);
 finishNew('<fresh/>');await fresh;
});
