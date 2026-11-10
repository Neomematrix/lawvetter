import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const context=vm.createContext({Request,Response,URL});
const modules=new Map();
async function load(file){
 file=path.resolve(file);if(modules.has(file))return modules.get(file);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code,{context,identifier:file});modules.set(file,mod);
 await mod.link(spec=>load(path.resolve(path.dirname(file),spec+'.ts')));return mod;
}
const city=await load('app/verified-city.ts');await city.evaluate();
const route=await load('worker/city-routes.ts');await route.evaluate();
test('location validation keeps legitimate namesakes and rejects licensing-state mismatches',()=>{
 const {verifiedCity,isVerifiedCityId}=city.namespace;
 for(const [name,state] of [['Atlanta','GA'],['Atlanta','TX'],['Atlanta','IL'],['Chicago','IL'],['Miami','FL'],['Marietta','GA'],['Orlando','FL'],['Doral','FL']]){
  const result=verifiedCity(name,state);assert.ok(result,name+', '+state);assert.ok(isVerifiedCityId(result.id));
 }
 for(const name of ['Atlanta','Chicago','Seattle','Los Angeles','Unknown','123 Main Street'])assert.equal(verifiedCity(name,'FL'),null,name);
 assert.equal(verifiedCity('  atlanta  ','ga')?.id,'atlanta-ga');
 assert.equal(verifiedCity('Atlanta','XX'),null);
 assert.equal(verifiedCity('Doral','GA'),null);
});
test('invalid local pages return real 404 and noindex for visitors and crawlers, including HEAD',async()=>{
 const {invalidCityResponse}=route.namespace;
 for(const method of ['GET','HEAD'])for(const location of ['atlanta-fl','chicago-fl','seattle-fl','unknown-xx','%E0%A4%A']){
  const result=invalidCityResponse(new Request('https://www.lawvetter.com/lawyers-in/'+location+'/personal-injury',{method}));
  assert.equal(result.status,404);assert.equal(result.headers.get('X-Robots-Tag'),'noindex, follow');
  const text=await result.text();if(method==='HEAD')assert.equal(text,'');else assert.match(text,/Find lawyers by city/);
 }
 for(const pathname of ['/lawyers-in/atlanta-ga/family-law','/lawyers-in/chicago-il/personal-injury','/lawyers-in/miami-fl/family-law','/lawyers-in/doral-fl/cannabis-law','/sitemap.xml','/api/attorneys','/lawyers/example'])assert.equal(invalidCityResponse(new Request('https://www.lawvetter.com'+pathname)),null);
});
