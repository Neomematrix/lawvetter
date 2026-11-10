import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const source='https://www.gabar.org/member-directory/?id=0123456789ABCDEF0123456789ABCDEF';
async function setup(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(`CREATE TABLE attorneys(bar_number TEXT PRIMARY KEY,license_number TEXT,source_id TEXT,state TEXT,imported_at TEXT,owner_edited INT,name TEXT,city TEXT,status TEXT,source_url TEXT);
 CREATE UNIQUE INDEX licenses ON attorneys(state,NULLIF(COALESCE(license_number,bar_number),''));
 CREATE TABLE attorney_profiles(bar_number TEXT PRIMARY KEY,owner_id TEXT,claimed_at TEXT,updated_at TEXT,photo_key TEXT,headline TEXT);
 CREATE TABLE admin_audit(id TEXT,actor TEXT,action TEXT,record_id TEXT,created_at TEXT);`);
 sqlite.exec("ALTER TABLE attorneys ADD COLUMN company TEXT NOT NULL DEFAULT ''");sqlite.exec(fs.readFileSync('drizzle/0047_free_zarda.sql','utf8'));
 const db={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:sqlite.prepare(sql).run(...args).changes}};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const context=vm.createContext({crypto,URL,console}),cache=new Map();
 const stubs={'db/raw.ts':{rawDb:()=>db},'db/directory-deletions.ts':{assertAttorneyAllowed:async()=>{},assertFirmAllowed:async()=>{},directoryInsertGuard:'? IS NOT NULL AND ? IS NOT NULL',licenseKey:()=>'',firmDeletionKey:()=>''},'app/api/attorneys/firm.ts':{firmKey:x=>x}};
 function get(file){if(cache.has(file))return cache.get(file);let m;if(stubs[file]){const values=stubs[file];m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});}else m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText,{context,identifier:file});cache.set(file,m);return m;}
 const module=get('db/admin-records.ts');await module.link((specifier,parent)=>get(path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier))+'.ts'));await module.evaluate();return {sqlite,...module.namespace,identity:cache.get('app/attorney-identity.ts').namespace};
}
const base={name:'Georgia Example',state:'GA',city:'Atlanta',barNumber:'',status:'Member in Good Standing',sourceUrl:source,photoKey:'attorneys/example/photo.jpg'};
test('Georgia requires a real official member URL without a number and still requires membership verification',async()=>{
 const x=await setup();assert.equal(x.validateAttorney(base).barNumber,'');
 for(const url of ['', 'https://gabar.org/','https://gabar.org.evil.test/member-directory/?id=0123456789ABCDEF','https://www.example.com/profile','http://www.gabar.org/member-directory/?id=0123456789ABCDEF'])assert.throws(()=>x.validateAttorney({...base,sourceUrl:url}),/official Georgia Bar/);
 for(const status of ['',undefined,'Not independently verified'])assert.throws(()=>x.validateAttorney({...base,status}),/membership status/);
 assert.equal(x.validateAttorney({...base,state:'FL'}).barNumber,'');x.sqlite.close();
});
test('Internal profile identity survives a later license number with photos and links intact; duplicates are blocked',async()=>{
 const x=await setup(),first=await x.saveAttorney(x.validateAttorney(base),'admin');
 assert.match(first.id,/^GA:LV/);assert.equal(x.identity.validAttorneyId(first.id),true);assert.equal(x.identity.displayBarNumber(first.id),'');
 assert.equal(x.sqlite.prepare('SELECT license_number FROM attorneys').get().license_number,'');
 const duplicate=await x.saveAttorney(x.validateAttorney({...base,sourceUrl:source.toLowerCase().replace('www.','')+'&tracking=test'}),'import',true,true);assert.equal(duplicate.skipped,true);
 await x.saveAttorney(x.validateAttorney({...base,recordId:first.id,barNumber:'123456',photoKey:''}),'admin');
 const saved=x.sqlite.prepare('SELECT * FROM attorneys').get();assert.equal(saved.bar_number,first.id);assert.equal(saved.license_number,'123456');assert.equal(x.sqlite.prepare('SELECT photo_key FROM attorney_profiles').get().photo_key,base.photoKey);
 const imported=await x.saveAttorney(x.validateAttorney({...base,barNumber:'123456'}),'import',true,true);assert.equal(imported.id,first.id);assert.equal(imported.skipped,true);assert.equal(x.sqlite.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,1);
 await x.saveAttorney(x.validateAttorney({...base,recordId:first.id,barNumber:'654321'}),'admin');assert.equal(x.sqlite.prepare('SELECT license_number FROM attorneys').get().license_number,'654321');x.sqlite.close();
});
test('Multiple attorneys without bar numbers stay separate and conflicting license assignments fail',async()=>{
 const x=await setup(),a=await x.saveAttorney(x.validateAttorney(base),'admin'),other={...base,name:'Other Attorney',sourceUrl:source.replace('0123456789ABCDEF0123456789ABCDEF','FEDCBA9876543210FEDCBA9876543210')},b=await x.saveAttorney(x.validateAttorney(other),'admin');assert.notEqual(a.id,b.id);
 await x.saveAttorney(x.validateAttorney({...base,recordId:a.id,barNumber:'123456'}),'admin');
 await assert.rejects(x.saveAttorney(x.validateAttorney({...other,recordId:b.id,barNumber:'123456'}),'admin'),/different directory records|already assigned/);assert.equal(x.sqlite.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,2);x.sqlite.close();
});

test('Clearing legacy Georgia licenses persists without changing profile identity or restoring the number',async()=>{
 const x=await setup();
 for(const id of ['691343','123456']){
  x.sqlite.prepare('INSERT INTO attorneys(bar_number,state,name,city,status,source_url) VALUES(?,?,?,?,?,?)').run(id,'GA','Legacy','Atlanta','Member in Good Standing',source+id);
  const record=x.validateAttorney({...base,recordId:id,sourceUrl:source.replace('0123456789ABCDEF0123456789ABCDEF',id)});
  if(id==='123456')x.sqlite.prepare('UPDATE attorneys SET license_number=? WHERE bar_number=?').run(id,id);
  await x.saveAttorney(record,'admin');
  assert.equal(x.sqlite.prepare('SELECT license_number FROM attorneys WHERE bar_number=?').get(id).license_number,'');
  assert.equal(x.identity.displayBarNumber(''),'');
  await x.saveAttorney({...record,barNumber:''},'import',true);
  assert.equal(x.sqlite.prepare('SELECT license_number FROM attorneys WHERE bar_number=?').get(id).license_number,'');
 }
 assert.equal(x.sqlite.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,2);
 x.sqlite.close();
});

 test('Tennessee attorneys without license numbers get separate persistent identities and can add a license later',async()=>{
 const x=await setup(),input={...base,state:'TN',city:'Chattanooga',sourceUrl:''};
 const a=await x.saveAttorney(x.validateAttorney(input),'admin');
 const b=await x.saveAttorney(x.validateAttorney({...input,name:'Other Tennessee Attorney'}),'admin');
 assert.notEqual(a.id,b.id);assert.match(a.id,/^TN:LV[0-9a-f]{32}$/);
 assert.equal(x.identity.validAttorneyId(a.id),true);assert.equal(x.identity.displayBarNumber(a.id),'');
 assert.equal(x.sqlite.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,2);
 await x.saveAttorney(x.validateAttorney({...input,recordId:a.id,barNumber:'12345',photoKey:''}),'admin');
 assert.equal(x.sqlite.prepare('SELECT license_number FROM attorneys WHERE bar_number=?').get(a.id).license_number,'12345');
 assert.equal(x.sqlite.prepare('SELECT photo_key FROM attorney_profiles WHERE bar_number=?').get(a.id).photo_key,input.photoKey);
 assert.throws(()=>x.validateAttorney({...input,status:''}),/membership status/);
 x.sqlite.close();
 });
 test('Repeated non-Georgia official profile URLs match the existing attorney without a license',async()=>{
 const x=await setup(),input={...base,state:'TN',city:'Chattanooga',sourceUrl:'https://example.com/member/123'};
 const a=await x.saveAttorney(x.validateAttorney(input),'admin');
 const b=await x.saveAttorney(x.validateAttorney(input),'admin');
 assert.equal(a.id,b.id);assert.equal(x.sqlite.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,1);x.sqlite.close();
 });

test('A saved Tennessee placeholder license can be corrected and cleared without losing its identity or portrait',async()=>{
 const x=await setup(),input={...base,state:'TN',city:'Chattanooga',sourceUrl:'',barNumber:'11111111'};
 const first=await x.saveAttorney(x.validateAttorney(input),'admin');
 await x.saveAttorney(x.validateAttorney({...input,recordId:first.id,barNumber:'23456',photoKey:''}),'admin');
 assert.equal(x.sqlite.prepare('SELECT license_number FROM attorneys').get().license_number,'23456');
 await x.saveAttorney(x.validateAttorney({...input,recordId:first.id,barNumber:'',photoKey:''}),'admin');
 const saved=x.sqlite.prepare('SELECT * FROM attorneys').get();assert.equal(saved.license_number,'');assert.equal(saved.bar_number,first.id);
 assert.equal(x.sqlite.prepare('SELECT photo_key FROM attorney_profiles').get().photo_key,input.photoKey);
 assert.equal(x.sqlite.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,1);x.sqlite.close();
});
