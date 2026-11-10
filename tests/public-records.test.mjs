import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
test('customer payloads hide internal identities and references resolve for existing features',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE attorneys(bar_number TEXT PRIMARY KEY,name TEXT,public_id TEXT);');
 db.exec("INSERT INTO attorneys VALUES('691343','Example Attorney',NULL),('FL:691343','Other Attorney',NULL)");
 const adapter={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async run(){return db.prepare(sql).run(...args);},async first(){return db.prepare(sql).get(...args);},async all(){return {results:db.prepare(sql).all(...args)};}};}};
 const context=vm.createContext({structuredClone,Response}),cache=new Map();
 const mocks={'db/raw.ts':{rawDb:()=>adapter},'app/verified-firm-rosters.ts':{verifiedFirmForAttorney:()=>null},'app/practice-areas.ts':{practiceSources:{},practiceAreas:[]},'app/firm-websites.ts':{attorneyBiographyWebsites:{},firmWebsites:{},websitesByFirm:{},linkedInByFirm:{},attorneyLinkedIn:{},confirmedFirmWebsite:()=>''},'app/published-attorney-details.ts':{publishedAttorneyDetails:()=>null}};
 function get(file){if(cache.has(file))return cache.get(file);let m;if(mocks[file])m=new vm.SyntheticModule(Object.keys(mocks[file]),function(){for(const [k,v]of Object.entries(mocks[file]))this.setExport(k,v);},{context});else m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,{context,identifier:file});cache.set(file,m);return m;}
 async function load(file){const m=get(file);if(m.status==='unlinked')await m.link((s,p)=>get(path.posix.normalize(path.posix.join(path.posix.dirname(p.identifier),s))+'.ts'));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}
 const {publicRecords,profileIdsResponse}=await load('db/public-records.ts'),{resolveAttorneyReference,resolveVerificationReference}=await load('db/attorney-reference.ts');
 const original={attorneys:[{bar_number:'691343',license_number:'691343',source_id:'691343',name:'Example Attorney',company:'',photo_key:'attorneys/691343/photo.jpg'}],requests:[{id:JSON.stringify(['customer','691343']),bar_number:'691343',attorney_photo_key:'attorneys/691343/photo.jpg'}],firm:{bars:['691343']}};
 const clean=await publicRecords(original),ref=clean.attorneys[0].bar_number;
 assert.match(ref,/^LV[a-f0-9]{32}$/);assert.equal(clean.requests[0].bar_number,ref);assert.match(clean.attorneys[0].photo_key,/^p[0-9a-f]+$/);assert.equal(clean.requests[0].attorney_photo_key,clean.attorneys[0].photo_key);const replacement=await publicRecords({attorneys:[{...original.attorneys[0],photo_key:'attorneys/691343/replacement.jpg'}]});assert.notEqual(replacement.attorneys[0].photo_key,clean.attorneys[0].photo_key);assert.ok(!JSON.stringify(clean).includes('691343'));assert.ok(!('bars'in clean.firm));assert.ok(!('license_number'in clean.attorneys[0]));assert.equal(original.attorneys[0].bar_number,'691343');
 assert.equal(await resolveAttorneyReference(ref),'691343');assert.equal(await resolveVerificationReference(clean.requests[0].id),original.requests[0].id);assert.equal(await resolveAttorneyReference('LV'+'0'.repeat(32)),'');assert.equal(await resolveAttorneyReference('FL:691343'),'FL:691343');
 assert.equal((await publicRecords(original)).attorneys[0].bar_number,ref);assert.notEqual((await publicRecords({bar_number:'FL:691343'})).bar_number,ref);
 assert.equal(await publicRecords(null),null);assert.equal((await profileIdsResponse(Response.json(original))).status,200);assert.equal((await profileIdsResponse(Response.json({bar_number:'missing'}))).status,503);
 db.close();
});
