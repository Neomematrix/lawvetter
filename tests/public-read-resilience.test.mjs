import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('db/public-read-cache.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {publicReadCache,retryPublicRead}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('Concurrent public reads share one query; expiration refreshes; failures are not cached',async()=>{
 let calls=0,release;const read=publicReadCache(()=>{calls++;return new Promise(resolve=>{release=resolve;});},10);
 const a=read(),b=read();await Promise.resolve();assert.equal(calls,1);release('first');assert.deepEqual(await Promise.all([a,b]),['first','first']);assert.equal(await read(),'first');assert.equal(calls,1);
 await new Promise(r=>setTimeout(r,20));const c=read();await Promise.resolve();release('next');assert.equal(await c,'next');assert.equal(calls,2);
 let fail=true;const recovery=publicReadCache(async()=>{if(fail)throw Error('offline');return 'recovered';},1000);await assert.rejects(recovery());fail=false;assert.equal(await recovery(),'recovered');
});
test('A transient D1 reset retries once; permanent errors and repeated failures propagate',async()=>{
 let calls=0;assert.equal(await retryPublicRead(async()=>{if(++calls===1)throw Error('D1_ERROR: D1 DB exceeded its CPU time limit and was reset.');return 'ok';}),'ok');assert.equal(calls,2);
 calls=0;await assert.rejects(retryPublicRead(async()=>{calls++;throw Error('SQLITE_CONSTRAINT');}));assert.equal(calls,1);
 calls=0;await assert.rejects(retryPublicRead(async()=>{calls++;throw Error('D1_ERROR: database reset');}));assert.equal(calls,2);
});

test('Invalidation refreshes saved settings and prevents an older pending read from replacing them',async()=>{
 let release,calls=0;const read=publicReadCache(()=>++calls===1?new Promise(resolve=>{release=resolve;}):Promise.resolve('saved'),10000);
 const old=read();await Promise.resolve();read.clear();assert.equal(await read(),'saved');release('old');assert.equal(await old,'old');assert.equal(await read(),'saved');assert.equal(calls,2);
});
