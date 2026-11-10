import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('app/firm-return.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {firmReturnTarget}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const origin='https://www.lawvetter.com';
test('firm back link preserves the originating firm chart and selected period after reload or roster pagination',()=>{
 const source='/?view=charts&chartKind=firms&period=monthly',search='?name=Grimes%20and%20Fertitta&page=2&returnTo='+encodeURIComponent(source);
 assert.deepEqual(firmReturnTarget(search,origin+'/firm?name=Grimes',origin),{href:source,label:'Back to firm charts'});
});
test('firm back link retains search filters and uses same-site referrers for existing firm links',()=>{
 const source='/discover?city=Atlanta&state=GA&page=3';
 assert.deepEqual(firmReturnTarget('?name=Example',origin+source,origin),{href:source,label:'Back to search results'});
 assert.equal(firmReturnTarget('?name=Example',origin+'/?view=charts&chartKind=firms',origin).label,'Back to firm charts');
});
test('direct visits and unsafe or self-referencing return destinations fall back to attorney search',()=>{
 for(const target of ['https://external.example','//external.example','/\\external.example','/firm?name=Example']){
  assert.equal(firmReturnTarget('?returnTo='+encodeURIComponent(target),'https://external.example',origin).href,'/discover');
 }
 assert.deepEqual(firmReturnTarget('?name=Example','',origin),{href:'/discover',label:'Back to attorney search'});
});

test('home search return destinations open Discover',()=>{
 for(const search of ['', '?returnTo=%2F', '?returnTo=%2F%23attorney-search'])assert.deepEqual(firmReturnTarget(search,origin+'/',origin),{href:'/discover',label:'Back to attorney search'});
});
