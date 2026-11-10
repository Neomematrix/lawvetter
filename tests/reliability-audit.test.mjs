import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {runtime} from './employment-runtime.mjs';
async function module(file,stubs={}){
 const m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 await m.link(spec=>new vm.SyntheticModule(Object.keys(stubs[spec]),function(){for(const [key,value] of Object.entries(stubs[spec]))this.setExport(key,value);}));await m.evaluate();return m.namespace;
}
test('Oversized UTF-8 and many-word searches fail validation before any database read',async()=>{
 const x=await runtime(),api=await x.load('app/api/attorneys/route.ts');x.db.prepare=()=>{throw Error('Database must not be consulted');};
 try{for(const params of [{q:'a '.repeat(10)},{q:'é'.repeat(30)},{city:'a'.repeat(60)},{q:'%'.repeat(30)}]){
  const get=await api.GET(new Request('https://lawvetter.test/api/attorneys?'+new URLSearchParams(params)));assert.equal(get.status,400);
  const post=await api.POST(new Request('https://lawvetter.test/api/attorneys',{method:'POST',headers:{origin:'https://lawvetter.test'},body:JSON.stringify(params)}));assert.equal(post.status,400);
 }}finally{x.sql.close();}
});
test('Ranking failure cannot replace successful attorney or firm search results',async()=>{
 const x=await runtime();x.seed('1','Jane Example','Example Legal');const api=await x.load('app/api/attorneys/route.ts'),prepare=x.db.prepare;
 x.db.prepare=text=>{if(text.includes('SELECT event_id FROM attorney_search_events'))throw Error('Simulated ranking outage');return prepare(text);};
 try{for(const params of [{q:'Jane Example',kind:'attorneys'},{q:'Example Legal',kind:'firms'},{firm:'Example Legal'}]){
  const response=await api.POST(new Request('https://lawvetter.test/api/attorneys',{method:'POST',headers:{origin:'https://lawvetter.test','user-agent':'Browser'},body:JSON.stringify({...params,eventId:'11111111-1111-4111-8111-111111111111'})}));assert.equal(response.status,200);const data=await response.json();assert.ok(data.attorneys?.length||data.firms?.length);
 }}finally{x.sql.close();}
});
test('Worker background ranking is retained without delaying the search',async()=>{
 const pending=[];let release;const blocked=new Promise(resolve=>{release=resolve;});
 const {backgroundTask}=await module('db/background-task.ts',{'cloudflare:workers':{waitUntil:work=>pending.push(work)}});
 await backgroundTask('test',()=>blocked);assert.equal(pending.length,1);release();await Promise.all(pending);
});
test('Import identity lookups remain ordered and bounded',async()=>{
 const {boundedMap}=await module('db/bounded-map.ts');let active=0,maximum=0;
 const result=await boundedMap(Array.from({length:100},(_,i)=>i),4,async value=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return value*2;});
 assert.equal(maximum,4);assert.deepEqual(result,Array.from({length:100},(_,i)=>i*2));
 let count=0;await assert.rejects(boundedMap([1,2,3,4,5],2,async value=>{count++;if(value===2)throw Error('failed');return value;}));assert.equal(count,2);
});
test('Existing authoritative public IDs require no additional database read and still hide licenses',async()=>{
 const x=await runtime();x.seed('1','Jane Example');const row=x.sql.prepare('SELECT * FROM attorneys').get(),m=await x.load('db/public-records.ts');
 x.db.prepare=()=>{throw Error('No additional identity lookup expected');};
 try{const result=await m.publicRecords({attorneys:[row]});assert.equal(result.attorneys[0].bar_number,'LV'+row.public_id);assert.equal(result.attorneys[0].license_number,undefined);assert.equal(result.attorneys[0].source_id,undefined);assert.equal(row.bar_number,'1');}finally{x.sql.close();}
});
test('Import employer classification does not query unrelated employers',async()=>{
 const x=await runtime(),m=await x.load('db/employer-classification.ts');x.db.prepare=()=>{throw Error('Unrelated maintenance must not run');};
 try{assert.equal(await m.reclassifyVerifiedEmployers(x.db,['Unrelated Law Firm']),0);}finally{x.sql.close();}
});

test('GET and submitted searches return a retryable response when their database reads stall',async()=>{
 const x=await runtime({setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?5:ms)}),api=await x.load('app/api/attorneys/route.ts');
 const never=new Promise(()=>{});x.db.prepare=()=>({bind(){return this;},first:()=>never,all:()=>never});
 try{for(const method of ['GET','POST']){
  const request=new Request('https://lawvetter.test/api/attorneys',{method,...(method==='POST'?{headers:{origin:'https://lawvetter.test'},body:'{"kind":"attorneys"}'}:{})});
  const response=await api[method](request);assert.equal(response.status,503);assert.equal(response.headers.get('Retry-After'),'5');assert.match((await response.json()).error,/taking longer/);
 }}finally{x.sql.close();}
});
