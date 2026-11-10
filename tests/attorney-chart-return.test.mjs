import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('app/attorney-chart-return.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {attorneyChartReturn}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const origin='https://www.lawvetter.com';
test('attorney breadcrumb returns to the originating chart with ranking and period intact',()=>{
 const source='/?view=charts&ranking=ratings&period=monthly';
 assert.deepEqual(attorneyChartReturn('?returnTo='+encodeURIComponent(source),'',origin),{href:source,label:'Back to attorney charts'});
 assert.deepEqual(attorneyChartReturn('',origin+'/?view=charts',origin),{href:'/?view=charts',label:'Back to attorney charts'});
});
test('ordinary visits keep Find a lawyer and external return destinations are ignored',()=>{
 for(const ref of ['',origin+'/discover','https://external.example/?view=charts'])assert.deepEqual(attorneyChartReturn('',ref,origin),{href:'/discover',label:'Find a lawyer'});
 for(const value of ['//external.example/?view=charts','https://external.example/?view=charts','/\\external.example/?view=charts'])assert.equal(attorneyChartReturn('?returnTo='+encodeURIComponent(value),'',origin).href,'/discover');
});
