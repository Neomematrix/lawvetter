import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function endpoint(){
 const source=fs.readFileSync('app/us-cities.ts','utf8'),catalog=JSON.parse(source.slice(source.indexOf('={')+1).trim().replace(/;$/,''));
 const code=ts.transpileModule(fs.readFileSync('app/api/cities/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const context=vm.createContext({Response,URL});const mod=new vm.SourceTextModule(code,{context});
 await mod.link(spec=>{const values=spec.includes('us-states')?{usStates:Object.keys(catalog),stateSearch:s=>({georgia:'GA',ga:'GA',florida:'FL',fl:'FL'})[s.toLowerCase()]||''}:spec.includes('us-cities')?{usCities:catalog}:null;assert.ok(values,'Suggestions must not depend on unverified directory records');return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});});await mod.evaluate();
 return async params=>{const response=await mod.namespace.GET(new Request('https://lawvetter.test/api/cities?'+new URLSearchParams(params)));return {status:response.status,data:await response.json()};};
}
test('City suggestions use known city/state pairs and exclude Atlanta, FL',async()=>{
 const get=await endpoint();let result=await get({format:'locations',q:'Atlanta'});assert.ok(result.data.locations.some(row=>row.label==='Atlanta, GA'));assert.ok(!result.data.locations.some(row=>row.label==='Atlanta, FL'));assert.ok(result.data.locations.some(row=>row.label==='Atlanta, IL'),'Valid same-name places remain available');
 result=await get({format:'locations',q:'Atlanta',state:'FL'});assert.equal(result.data.locations.length,0);
 result=await get({format:'locations',q:'Atlanta, GA'});assert.deepEqual(result.data.locations.map(row=>row.label),['Atlanta, GA']);
 result=await get({q:'Atlanta',state:'FL'});assert.equal(result.data.cities.length,0);
 result=await get({q:'Atlanta',state:'GA'});assert.deepEqual(result.data.cities,['Atlanta']);
});
test('Suggestions respect the selected state and reject unknown states and address text',async()=>{
 const get=await endpoint();for(const format of ['', 'locations']){for(const q of ['1725 Windward','123 Main Street','Unknown']){const {data}=await get({format,q,state:'GA'});assert.equal((data.cities||data.locations).length,0);}}
 assert.equal((await get({state:'XX'})).status,400);assert.equal((await get({format:'locations',q:'Atlanta, GA',state:'FL'})).data.locations.length,0);
 const result=await get({format:'locations',q:'Miami',state:'FL'});assert.ok(result.data.locations.length);assert.ok(result.data.locations.every(row=>row.state==='FL'));
});
