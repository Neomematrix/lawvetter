import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function requestWith(fetch){const context=vm.createContext({fetch,FormData,JSON,Error});const code=ts.transpileModule(fs.readFileSync('app/client-review-request.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;const m=new vm.SourceTextModule(code,{context});await m.link(()=>{});await m.evaluate();return m.namespace.clientReviewRequest;}
test('Unexpected HTML response gives a useful message, not a Safari JSON parsing error',async()=>{const request=await requestWith(async()=>new Response('<html>Unavailable</html>',{status:503}));await assert.rejects(request({action:'request'}),/unexpected response.*entries are still here/);});
test('JSON and uploaded evidence use correct headers and retain server errors',async()=>{for(const evidence of [null,new File(['proof'],'court.pdf',{type:'application/pdf'})]){const request=await requestWith(async(url,options)=>{assert.equal(options.headers.Accept,'application/json');if(evidence){assert.equal(options.headers['Content-Type'],undefined);assert.equal(options.body.get('photo').name,'court.pdf');assert.equal(JSON.parse(options.body.get('data')).action,'request');}else{assert.equal(options.headers['Content-Type'],'application/json');}return Response.json({error:'Enter your court name.'},{status:400});});await assert.rejects(request({action:'request'},evidence),/Enter your court name/);}});
