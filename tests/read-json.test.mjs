import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function client(fetch){const context=vm.createContext({fetch,Response,Error,AbortController,setTimeout,clearTimeout});const source=ts.transpileModule(fs.readFileSync('app/read-json.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const mod=new vm.SourceTextModule(source,{context});await mod.link(()=>{});await mod.evaluate();return mod.namespace;}
test('HTML timeout pages retry once and never surface JSON parser errors',async()=>{
 let calls=0;const {readJson}=await client(async()=>{calls++;return new Response('<!DOCTYPE html><h1>Timeout</h1>',{status:504,headers:{'content-type':'text/html'}});});
 await assert.rejects(readJson('/api/admin/records'),/server did not return/);assert.equal(calls,2);
});
test('Transient read failure recovers, while authentication and validation failures never retry',async()=>{
 let calls=0;const {readJson}=await client(async()=>++calls===1?new Response('<html>bad gateway</html>',{status:502}):Response.json({records:[{name:'Existing attorney'}]}));
 assert.equal((await readJson('/api/admin/records')).records[0].name,'Existing attorney');assert.equal(calls,2);
 for(const status of [401,403,400]){let count=0;const api=await client(async()=>{count++;return Response.json({error:'Invalid request'},{status});});await assert.rejects(api.readJson('/api/admin/records'));assert.equal(count,1);}
});
test('Deadline rejects unresolved work and cancels its request; settled work clears the deadline',async()=>{
 const {readDeadline}=await client(()=>{});let cancelled=false;
 await assert.rejects(readDeadline(new Promise(()=>{}),5,()=>{cancelled=true;}),/timed out/);assert.equal(cancelled,true);
 assert.equal(await readDeadline(Promise.resolve('loaded'),100), 'loaded');
});
