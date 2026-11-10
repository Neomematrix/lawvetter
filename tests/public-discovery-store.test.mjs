import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function setup(){
 const objects=new Map(),scheduled=[],env={PROFILE_PHOTOS:{async put(key,body){objects.set(key,await new Response(body).text());},async get(key){const text=objects.get(key);return text?{body:new Response(text).body}:null;}}};
 const context=vm.createContext({Request,Response,URL,Promise,console});
 const code=ts.transpileModule(fs.readFileSync('db/public-discovery-store.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});
 await mod.link(spec=>{const values=spec==='cloudflare:workers'?{env,waitUntil:p=>scheduled.push(p)}:{readDeadline:p=>p};return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});
 await mod.evaluate();return {store:mod.namespace.discoverySnapshotStore,keep:mod.namespace.keepDiscoveryRefresh,objects,scheduled,env};
}
const request=new Request('https://www.lawvetter.com/__public-snapshot/discovery/2026-11');
test('sanitized public JSON survives cache eviction and is readable by a new store',async()=>{
 const x=await setup(),store=await x.store();
 assert.equal(await store.match(request),undefined);
 await store.put(request,Response.json({at:123,value:{weekly:[{bar_number:'LVpublic',rank:1}]}}));
 assert.deepEqual([...x.objects.keys()],['public-snapshots/discovery/2026-11.json']);
 const newStore=await x.store();assert.equal((await(await newStore.match(request)).json()).value.weekly[0].rank,1);
 assert.equal(await newStore.match(new Request('https://www.lawvetter.com/__public-snapshot/discovery/2026-12')),undefined);
});
test('background refresh is registered with the Worker request lifetime',async()=>{
 const x=await setup(),work=Promise.resolve();x.keep(work);assert.equal(x.scheduled[0],work);
});
