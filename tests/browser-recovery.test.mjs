import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import vm from 'node:vm';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('worker/browser-recovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL,Response});
test('Recovery is a standalone document that clears only cached files and preserves cookies',async()=>{
 const response=exports.browserRecoveryResponse(new Request('https://www.lawvetter.com/recover'));
 assert.equal(response.headers.get('Clear-Site-Data'),'"cache"');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.has('Set-Cookie'),false);
 const body=await response.text();assert.match(body,/href="\/"/);assert.doesNotMatch(body,/<script|\/assets\//);
 assert.equal(exports.browserRecoveryResponse(new Request('https://www.lawvetter.com/')),null);
});
