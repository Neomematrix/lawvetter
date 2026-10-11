import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function client(fetch){const context=vm.createContext({fetch,Response,URLSearchParams,Error,TypeError});const source=ts.transpileModule(fs.readFileSync('app/attorney-request.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const m=new vm.SourceTextModule(source,{context});await m.link(()=>{});await m.evaluate();return m.namespace.requestAttorneyData;}
test('Network failure falls back to read-only GET with preserved search parameters',async()=>{const calls=[];const request=await client(async(url,options)=>{calls.push({url,options});if(calls.length===1)throw new TypeError('Failed to fetch');return Response.json({total:3});});assert.equal((await request({q:'Hines',page:2,eventId:'same-event'})).total,3);assert.equal(calls[0].options.method,'POST');assert.equal(calls[1].options.method,'GET');assert.match(calls[1].url,/q=Hines/);assert.match(calls[1].url,/page=2/);assert.equal(calls[1].options.body,undefined);});
test('Expired sessions do not retry and cancelled requests stay cancelled',async()=>{let calls=0;const request=await client(async()=>{calls++;return Response.json({error:'Sign in'},{status:401});});await assert.rejects(request({home:'1'}),/session/);assert.equal(calls,1);const abort=new Error('cancelled');abort.name='AbortError';const cancelled=await client(async()=>{throw abort;});await assert.rejects(cancelled({home:'1'}),{name:'AbortError'});});
