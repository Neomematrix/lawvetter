import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
let source=fs.readFileSync('app/location-options.ts','utf8');
for(const [variable,file] of [['counties','location-counties'],['courts','location-courts-ga']])source=source.replace(`import ${variable} from './${file}.json';`,`const ${variable}=${fs.readFileSync('app/'+file+'.json','utf8')};`);
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {countyOptions,courtOptions}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('Counties narrow by selected state, case-insensitive text and accents',()=>{
 assert.deepEqual(countyOptions('GA','cHeR'),['Cherokee County']);
 assert.deepEqual(countyOptions('GA','los ang'),[]);
 assert.deepEqual(countyOptions('CA','los ang'),['Los Angeles County']);
 assert.ok(countyOptions('PR','anasco').includes('Añasco Municipio'));
 assert.deepEqual(countyOptions('XX','cher'),[]);
});
test('Court suggestions are scoped to selected state and county, and narrow by court type',()=>{
 assert.deepEqual(courtOptions('GA','cherokee county','SUPER'),['Cherokee County Superior Court']);
 assert.equal(courtOptions('GA','Cherokee','').length,3);
 assert.deepEqual(courtOptions('GA','Cherokee','fulton'),[]);
 assert.deepEqual(courtOptions('NC','Cherokee',''),[]);
 assert.deepEqual(courtOptions('GA','',''),[]);
 assert.deepEqual(courtOptions('GA','unlisted county',''),[]);
});
