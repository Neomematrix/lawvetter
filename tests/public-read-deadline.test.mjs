import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('db/public-read-cache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function setup(extra={}){const exports={};vm.runInNewContext(code,{exports,setTimeout,clearTimeout,Date,...extra});return exports.publicReadCache;}
test('a hung read expires, allows retry, and cannot overwrite the successful retry',async()=>{
 let finish,calls=0;
 const read=setup()(()=>++calls===1?new Promise(resolve=>{finish=resolve;}):Promise.resolve('new'),60000,15);
 await assert.rejects(read(),/timed out/);
 assert.equal(await read(),'new');finish('old');await new Promise(r=>setImmediate(r));assert.equal(await read(),'new');assert.equal(calls,2);
});
test('new requests discard expired work even if an earlier request timer never ran',async()=>{
 let now=0,finish,calls=0;
 const read=setup({Date:{now:()=>now},setTimeout:()=>0,clearTimeout:()=>{}})(()=>++calls===1?new Promise(resolve=>{finish=resolve;}):Promise.resolve('fresh'),60000,100);
 const old=read();await Promise.resolve();now=101;
 assert.equal(await read(),'fresh');finish('stale');await old;assert.equal(await read(),'fresh');
});
test('simultaneous reads still share one database query',async()=>{
 let calls=0;const read=setup()(async()=>{calls++;return 'value';},60000,100);
 assert.deepEqual(await Promise.all([read(),read(),read()]),['value','value','value']);assert.equal(calls,1);
});
test('a canceled request cannot lend its unfinished I/O to a later request',async()=>{
 const exports={};vm.runInNewContext(code,{exports,setTimeout,clearTimeout,Date});
 let scope={},finish,calls=0;exports.configurePublicReadScope(()=>scope);
 const read=exports.publicReadCache(()=>++calls===1?new Promise(resolve=>{finish=resolve;}):Promise.resolve('healthy'),60000,1000);
 const canceled=read();await Promise.resolve();scope={};
 assert.equal(await read(),'healthy');assert.equal(calls,2);
 finish('abandoned');await canceled;scope={};assert.equal(await read(),'healthy');
});
