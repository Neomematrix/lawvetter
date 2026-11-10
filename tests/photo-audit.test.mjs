import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

test('Photo audit requires admin, distinguishes missing files from read errors, and finds disconnected uploads without writes',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(`CREATE TABLE attorneys(bar_number TEXT,name TEXT,public_id TEXT);CREATE TABLE attorney_profiles(bar_number TEXT,photo_key TEXT);
 INSERT INTO attorneys VALUES('1','Available','a'),('2','Missing','b'),('3','Read error','c'),('4','Disconnected','d'),('5','External','e');
 INSERT INTO attorney_profiles VALUES('1','attorneys/1/current.jpg'),('2','attorneys/2/lost.jpg'),('3','attorneys/3/error.jpg'),('4',''),('5','https://example.test/photo.jpg');`);
 let admin=false;const db={prepare(sql){assert.match(sql,/^SELECT/);let args=[];return {bind(...v){args=v;return this;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};}};
 const bucket={async head(key){if(key.includes('error'))throw Error('storage unavailable');return key.includes('current')?{}:null;},async list(){return {objects:[{key:'attorneys/1/older.jpg',uploaded:new Date()},{key:'attorneys/4/original.jpg',uploaded:new Date()},{key:'attorneys/deleted/old.jpg',uploaded:new Date()}],truncated:false};}};
 const stubs={'cloudflare:workers':{env:{PROFILE_PHOTOS:bucket}},'../../../../db/admin-auth':{adminIdentity:async()=>admin?{}:null},'../../../../db/raw':{rawDb:()=>db},'../../../../db/attorney-reference':{resolveAttorneyReference:async x=>x},'../../../../db/directory-details':{directoryDetails:()=>({})},'../../../../db/attorney-submission':{decodeAttorneyDraft:()=>null}};
 const context=vm.createContext({Request,Response,URL,console}),code=ts.transpileModule(fs.readFileSync('app/api/admin/photo-audit/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText,mod=new vm.SourceTextModule(code,{context});
 await mod.link(spec=>{const values=stubs[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});await mod.evaluate();
 const get=mode=>mod.namespace.GET(new Request('https://lawvetter.test/api/admin/photo-audit?mode='+mode));
 assert.equal((await get('references')).status,401);admin=true;
 const refs=await (await get('references')).json();assert.equal(refs.checked,3);assert.equal(refs.available,1);assert.equal(refs.missing.length,1);assert.equal(refs.missing[0].name,'Missing');assert.equal(refs.errors.length,1);assert.equal(refs.errors[0].name,'Read error');
 const objects=await (await get('objects')).json();assert.equal(objects.objects,3);assert.equal(objects.lostLinks.length,1);assert.equal(objects.lostLinks[0].name,'Disconnected');assert.equal(sqlite.prepare('SELECT count(*) AS n FROM attorneys').get().n,5);sqlite.close();
});
