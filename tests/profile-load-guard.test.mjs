import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('worker/profile-load-guard.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Response,Date,console});
const req=(ip='1',path='/lawyers/example',headers={})=>new Request('https://example.test'+path,{headers:{'cf-connecting-ip':ip,...headers}});
test('Concurrent cold profiles are bounded and capacity is released after success or failure',async()=>{
 const guard=exports.createProfileLoadGuard(2);let release;const stalled=new Promise(r=>release=r);const first=guard(req('1'),()=>stalled),second=guard(req('2'),()=>stalled);let ran=false;
 const busy=await guard(req('3'),async()=>{ran=true;return new Response('bad');});assert.equal(busy.status,429);assert.equal(ran,false);assert.equal(busy.headers.get('Retry-After'),'10');release(new Response('ok'));await Promise.all([first,second]);
 await assert.rejects(guard(req(),async()=>{throw Error('fail');}));assert.equal((await guard(req(),async()=>new Response('ok'))).status,200);
});
test('One client cannot consume unlimited cold reads; other clients and signed-in requests remain available',async()=>{
 const guard=exports.createProfileLoadGuard(8,2),load=async()=>new Response('ok');await guard(req(),load);await guard(req(),load);assert.equal((await guard(req(),load)).status,429);assert.equal((await guard(req('2'),load)).status,200);assert.equal((await guard(req('1','/lawyers/example',{cookie:'__Host-lawvetter-client=session'}),load)).status,200);assert.equal((await guard(req('1','/api/attorneys'),load)).status,200);
});
