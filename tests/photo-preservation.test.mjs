import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

test('Saving details preserves photos for absent, empty and whitespace values; explicit replacement still works; duplicate import leaves photo intact',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(`CREATE TABLE attorneys(bar_number TEXT PRIMARY KEY,license_number TEXT,source_id TEXT,state TEXT,imported_at TEXT,owner_edited INT,name TEXT,status TEXT,source_url TEXT);
 CREATE TABLE attorney_profiles(bar_number TEXT PRIMARY KEY,owner_id TEXT,claimed_at TEXT,updated_at TEXT,photo_key TEXT,headline TEXT);
 CREATE TABLE admin_audit(id TEXT,actor TEXT,action TEXT,record_id TEXT,created_at TEXT);
 INSERT INTO attorneys VALUES('FL:31292','31292','original','FL','',0,'Jack Abid','','');
 INSERT INTO attorney_profiles VALUES('FL:31292','','','','attorneys/FL:31292/original.jpg','');`);
 sqlite.exec("ALTER TABLE attorneys ADD COLUMN company TEXT NOT NULL DEFAULT ''");sqlite.exec(fs.readFileSync('drizzle/0047_free_zarda.sql','utf8'));
 sqlite.exec("ALTER TABLE attorney_profiles ADD COLUMN languages TEXT NOT NULL DEFAULT ''");
 const db={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:sqlite.prepare(sql).run(...args).changes}};}};},async batch(statements){const results=[];for(const s of statements)results.push(await s.run());return results;}};
 const stubs={'../app/languages':{normalizeLanguages:x=>x||''},
 './verified-employers':{verifiedEmployer:()=>undefined},'../app/employment':{employmentType:x=>x||'Law Firm Attorney'},'../app/membership-status':{RETIRED:'Retired',validatedMembershipStatus:x=>x,isActiveMembership:x=>/^(Active|Member in Good Standing)$/.test(x)},'../app/attorney-location':{requireAttorneyLocation:()=>{}},'../app/linkedin-url':{linkedInUrl:x=>x},
 './directory-deletions':{assertAttorneyAllowed:async()=>{},assertFirmAllowed:async()=>{},directoryInsertGuard:'? IS NOT NULL AND ? IS NOT NULL',licenseKey:()=>'',firmDeletionKey:()=>''},
 '../app/attorney-identity':{normalizeBarNumber:(_s,n)=>n,georgiaBarProfile:()=>'',requireGeorgiaIdentity:()=>{},validAttorneyId:()=>true},'../app/api/attorneys/firm':{firmKey:x=>x},'./raw':{rawDb:()=>db},
 './attorney-identity':{licensedAttorney:async()=>({bar_number:'FL:31292'}),directoryAttorneyId:async()=> 'FL:31292'}
 };
 const context=vm.createContext({crypto,console});const code=ts.transpileModule(fs.readFileSync('db/admin-records.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const exports=stubs[spec];assert.ok(exports,spec);return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});});await mod.evaluate();
 const base={name:'Jack Abid',state:'FL',barNumber:'31292',status:'Member in Good Standing',headline:'Updated details'};
 const photo=()=>sqlite.prepare('SELECT photo_key FROM attorney_profiles').get().photo_key;
 for(const extra of [{},{photoKey:''},{photoKey:'   '}]){await mod.namespace.saveAttorney({...base,...extra},'admin');assert.equal(photo(),'attorneys/FL:31292/original.jpg');}
 assert.equal(sqlite.prepare('SELECT headline FROM attorney_profiles').get().headline,'Updated details');
 const skipped=await mod.namespace.saveAttorney({...base,photoKey:'https://example.test/import.jpg'},'import',true,true);assert.equal(skipped.skipped,true);assert.equal(photo(),'attorneys/FL:31292/original.jpg');
 await mod.namespace.saveAttorney({...base,photoKey:'attorneys/FL:31292/replacement.jpg'},'admin');assert.equal(photo(),'attorneys/FL:31292/replacement.jpg');
 sqlite.close();
});
