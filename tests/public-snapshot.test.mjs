import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(){
 let now=1000000;const exports={},entries=new Map();
 class Clock extends Date{static now(){return now;}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('db/public-snapshot.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date:Clock,Request,Response,console:{warn(){}}});
 const cache={async match(key){return entries.get(key.url)?.clone();},async put(key,response){entries.set(key.url,response);}};
 return {snapshot:exports.publicSnapshot,cache,advance(ms){now+=ms;}};
}
const key=()=>'https://example.test/discovery/2026-11';
test('Concurrent homepage readers share one calculation and a new isolate reuses the sanitized snapshot',async()=>{
 const x=setup();let calls=0,release;const loading=new Promise(resolve=>release=resolve);
 const read=x.snapshot(async()=>{calls++;await loading;return {weekly:[{bar_number:'LVpublic',rank:1}]};},async()=>x.cache,key);
 const a=read(),b=read();release();assert.deepEqual(await a,await b);assert.equal(calls,1);
 const newIsolate=x.snapshot(async()=>{throw Error('Database unavailable');},async()=>x.cache,key);
 assert.equal((await newIsolate()).weekly[0].rank,1);
});
test('Overload serves a successful snapshot and backs off; recovered data replaces it',async()=>{
 const x=setup();let calls=0,fail=false;
 const read=x.snapshot(async()=>{calls++;if(fail)throw Error('D1 overloaded');return {rank:calls};},async()=>x.cache,key,1000,10000);
 await read();x.advance(1001);fail=true;assert.equal((await read()).rank,1);await read();assert.equal(calls,2);
 x.advance(30001);fail=false;assert.equal((await read()).rank,3);
});
test('An absent snapshot fails honestly and backs off without flooding the database',async()=>{
 const x=setup();let calls=0;
 const read=x.snapshot(async()=>{calls++;throw Error('D1 overloaded');},async()=>x.cache,key);
 await assert.rejects(read(),/overloaded/);await assert.rejects(read(),/overloaded/);assert.equal(calls,1);
});
test('Expired or previous-month data is never presented as current rankings',async()=>{
 const x=setup();let month='2026-11',fail=false;
 const read=x.snapshot(async()=>{if(fail)throw Error('unavailable');return {month};},async()=>x.cache,()=>'https://example.test/'+month,1000,2000);
 await read();fail=true;x.advance(2001);await assert.rejects(read(),/unavailable/);
 month='2026-12';await assert.rejects(read(),/unavailable/);
});

test('warm and cold isolates return stale rankings while one blocked refresh continues in the background',async()=>{
 const x=setup(),work=[];let release,calls=0;
 const read=x.snapshot(async()=>({rank:1}),async()=>x.cache,key,1000,10000,p=>work.push(p));
 await read();await Promise.all(work);x.advance(1001);
 const refresh=new Promise(resolve=>release=resolve);
 const cold=x.snapshot(async()=>{calls++;await refresh;return {rank:2};},async()=>x.cache,key,1000,10000,p=>work.push(p));
 assert.equal((await cold()).rank,1);assert.equal((await cold()).rank,1);assert.equal(calls,1);
 release();await Promise.all(work);assert.equal((await cold()).rank,2);
});
test('a blocked snapshot write does not block a successful ranking response',async()=>{
 const x=setup(),work=[];let release;
 const blocked=new Promise(resolve=>release=resolve);
 const read=x.snapshot(async()=>({rank:1}),async()=>({match:async()=>undefined,put:()=>blocked}),key,1000,10000,p=>work.push(p));
 assert.equal((await read()).rank,1);release();await Promise.all(work);
});
test('background failure retains valid rankings, backs off and does not produce unhandled rejections',async()=>{
 const x=setup(),work=[];let calls=0,fail=false;
 const read=x.snapshot(async()=>{calls++;if(fail)throw Error('overload');return {rank:1};},async()=>x.cache,key,1000,10000,p=>work.push(p));
 await read();await Promise.all(work);x.advance(1001);fail=true;
 assert.equal((await read()).rank,1);await Promise.all(work);assert.equal((await read()).rank,1);assert.equal(calls,2);
 x.advance(10000);await assert.rejects(read(),/overload/);
});
