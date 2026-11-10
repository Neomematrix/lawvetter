import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(){
 let now=Date.parse('2026-11-10T06:00:00Z'),counter=0,failWrite=false;
 const entries=new Map(),work=[];
 class Clock extends Date{static now(){return now;}}
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('db/ranking-snapshot.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({readDeadline:p=>p}),Date:Clock,Intl,crypto,console:{warn(){}}});
 const bucket={async head(key){return entries.get(key)||null;},async get(key){const e=entries.get(key);return e?{...e,json:async()=>JSON.parse(e.body)}:null;},async put(key,body,options){
  if(failWrite&&key===exports.rankingSnapshotKey)throw Error('storage failed');
  const old=entries.get(key),condition=options?.onlyIf;
  if(condition?.etagMatches&&old?.etag!==condition.etagMatches)return null;
  if(condition?.etagDoesNotMatch==='*'&&old)return null;
  const saved={etag:String(++counter),body,customMetadata:options?.customMetadata};entries.set(key,saved);return saved;
 }};
 return {...exports,entries,now:()=>now,setNow:v=>now=Date.parse(v),failWrite:()=>failWrite=true,read:load=>exports.rankingSnapshot(bucket,load,p=>work.push(p),async()=>undefined),flush:async()=>{await Promise.all(work);work.length=0;}};
}
test('three-day cadence is anchored at 1am Eastern across months and DST',()=>{
 const {rankingSlot:s}=setup();
 for(const [at,expected] of [['2026-11-10T05:59:59Z','2026-11-07'],['2026-11-10T06:00:00Z','2026-11-10'],['2026-11-13T05:59:59Z','2026-11-10'],['2026-11-13T06:00:00Z','2026-11-13'],['2026-12-01T06:00:00Z','2026-12-01'],['2027-03-16T04:59:59Z','2027-03-13'],['2027-03-16T05:00:00Z','2027-03-16']])assert.equal(s(Date.parse(at)),expected,at);
});
test('independent readers share one calculation, persist it, and do not refresh before due',async()=>{
 const x=setup();let calls=0;const load=async()=>({rank:++calls});
 const first=x.read(load);assert.equal((await first()).rank,1);await x.flush();
 x.setNow('2026-11-13T05:59:59Z');assert.equal((await x.read(load)()).rank,1);assert.equal(calls,1);
 x.setNow('2026-11-13T06:00:00Z');const a=x.read(load),b=x.read(load);
 await Promise.all([a(),b()]);await x.flush();assert.equal(calls,2);
 assert.equal((await x.read(load)()).rank,2);
});
test('failed refresh retains last success across a month boundary',async()=>{
 const x=setup();const read=x.read(async()=>({rank:1}));await read();await x.flush();
 x.setNow('2026-12-01T06:00:00Z');const failed=x.read(async()=>{throw Error('overloaded');});
 assert.equal((await failed()).rank,1);await x.flush();assert.equal((await failed()).rank,1);
 assert.equal(JSON.parse(x.entries.get(x.rankingSnapshotKey).body).value.rank,1);
});
test('failed durable write cannot replace the last successful ranking',async()=>{
 const x=setup();await x.read(async()=>({rank:1}))();await x.flush();
 x.setNow('2026-11-13T06:00:00Z');x.failWrite();const next=x.read(async()=>({rank:2}));await next();await x.flush();
 assert.equal((await next()).rank,1);assert.equal(JSON.parse(x.entries.get(x.rankingSnapshotKey).body).value.rank,1);
});
