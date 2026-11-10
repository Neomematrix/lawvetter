import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
async function moduleAt(file){const m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);await m.link(()=>{});await m.evaluate();return m.namespace;}
test('migration and bounded allocation assign stable public IDs without changing licenses',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE attorneys(bar_number TEXT PRIMARY KEY,license_number TEXT,name TEXT,state TEXT);');db.exec("INSERT INTO attorneys VALUES('123456','123456','Same Name','GA'),('FL:123456','123456','Same Name','FL')");db.exec(fs.readFileSync('drizzle/0033_normal_overlord.sql','utf8'));
 const m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('db/public-profile-ids.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);await m.link(()=>new vm.SyntheticModule(['rawDb'],function(){this.setExport('rawDb',()=>({prepare(sql){let args=[];return {bind(...a){args=a;return this;},async run(){return db.prepare(sql).run(...args);},async all(){return {results:db.prepare(sql).all(...args)};}};}}));}));await m.evaluate();
 const initial=db.prepare('SELECT * FROM attorneys').all();await m.namespace.ensurePublicProfileIds({attorneys:initial});assert.ok(initial.every(x=>x.public_id));const stable=initial[0].public_id;await m.namespace.ensurePublicProfileIds({attorneys:initial});assert.equal(initial[0].public_id,stable);

 let rows=db.prepare('SELECT * FROM attorneys').all();assert.notEqual(rows[0].public_id,rows[1].public_id);for(const row of rows)assert.match(row.public_id,/^[a-f0-9]{32}$/);
 const old=rows[0].public_id;db.exec("UPDATE attorneys SET name='Updated Name',license_number='654321' WHERE bar_number='123456'");assert.equal(db.prepare("SELECT public_id FROM attorneys WHERE bar_number='123456'").get().public_id,old);
 db.exec("INSERT INTO attorneys(bar_number,license_number,name,state) VALUES('333333','333333','New Person','GA')");assert.match(db.prepare("SELECT public_id FROM attorneys WHERE bar_number='333333'").get().public_id,/^[a-f0-9]{32}$/);db.close();
});
test('hidden licenses remain searchable, with state-qualified lookup separating identical numbers',async()=>{
 const {attorneyNameSearch}=await moduleAt('app/api/attorneys/search.ts'),{publicLicenseColumn}=await moduleAt('db/public-attorney.ts');const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE attorneys(bar_number TEXT,license_number TEXT,name TEXT,company TEXT,state TEXT)');db.exec("INSERT INTO attorneys VALUES('123456','123456','Example A','','GA'),('FL:123456','123456','Example B','','FL')");
 db.exec("ALTER TABLE attorneys ADD COLUMN employer_name TEXT NOT NULL DEFAULT ''; ALTER TABLE attorneys ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'Law Firm Attorney'");
 const search=q=>{const s=attorneyNameSearch(q);return db.prepare('SELECT state,'+publicLicenseColumn()+' FROM attorneys WHERE '+s.where).all(...s.args);};assert.equal(search('123456').length,2);assert.deepEqual(search('FL:123456').map(x=>x.state),['FL']);assert.deepEqual(search('GA-123456').map(x=>x.state),['GA']);assert.equal(search('FL:123456')[0].license_number,'');assert.equal(db.prepare("SELECT license_number FROM attorneys WHERE state='FL'").get().license_number,'123456');db.close();
});
