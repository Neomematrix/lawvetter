import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

test('Reviewed judge cleanup resumes, preserves profiles, and rejects staff, identity changes and deceased records',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec("CREATE TABLE attorneys(bar_number TEXT PRIMARY KEY,name TEXT,company TEXT,state TEXT,status TEXT); CREATE TABLE attorney_profiles(bar_number TEXT PRIMARY KEY,owner_id TEXT NOT NULL,claimed_at TEXT NOT NULL,updated_at TEXT NOT NULL,practice_areas TEXT NOT NULL DEFAULT '',photo_key TEXT DEFAULT '',website TEXT DEFAULT '',bio TEXT DEFAULT ''); CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT); CREATE TABLE admin_audit(id TEXT PRIMARY KEY,actor TEXT,action TEXT,record_id TEXT,created_at TEXT);");
 const targets=Array.from({length:104},(_,i)=>({bar:String(i),name:'Judge Person '+i,company:'Court '+i,source:'https://court.test/'}));
 for(const t of targets)sqlite.prepare('INSERT INTO attorneys VALUES(?,?,?,?,?)').run(t.bar,t.name,t.company,'GA','Member in Good Standing');
 sqlite.prepare('INSERT INTO attorneys VALUES(?,?,?,?,?)').run('staff','Sharon Reiss','Council of Magistrate Court Judges','GA','Member in Good Standing');
 sqlite.prepare('INSERT INTO attorney_profiles VALUES(?,?,?,?,?,?,?,?)').run('0','owner','claimed','old','Family law','saved-photo','https://court.test/','Existing bio');
 sqlite.prepare('INSERT INTO attorney_profiles VALUES(?,?,?,?,?,?,?,?)').run('1','owner','claimed','old','Judge','other-photo','','');
 sqlite.prepare("UPDATE attorneys SET name='Different Person' WHERE bar_number='2'").run();
 sqlite.prepare("UPDATE attorneys SET status='Deceased' WHERE bar_number='3'").run();
 sqlite.prepare("UPDATE attorneys SET state='FL' WHERE bar_number='4'").run();
 const db={prepare(sql){return {values:[],bind(...values){this.values=values;return this;},async first(){return sqlite.prepare(sql).get(...this.values)||null;},async all(){return {results:sqlite.prepare(sql).all(...this.values)};},async run(){return {meta:{changes:sqlite.prepare(sql).run(...this.values).changes}};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 const context=vm.createContext({console,Date,JSON,Map,Promise});
 const source=ts.transpileModule(fs.readFileSync('db/verified-judicial-categories.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const module=new vm.SourceTextModule(source,{context});
 await module.link(async name=>{
  const values=name.includes('verified-judges')?{verifiedJudges:targets}:{practiceCategoryId:value=>value.trim().toLowerCase(),splitPracticeAreas:value=>value.split(/[,;|\n]+/).map(x=>x.trim()).filter(Boolean)};
  return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});
 });await module.evaluate();
 const run=module.namespace.ensureVerifiedJudicialCategories;
 await Promise.all([run(db),run(db)]);
 let report=JSON.parse(sqlite.prepare('SELECT value FROM site_settings').get().value);
 assert.equal(report.offset,100);assert.equal(report.status,'pending');
 await run(db);
 report=JSON.parse(sqlite.prepare('SELECT value FROM site_settings').get().value);
 assert.equal(report.status,'complete');assert.equal(report.offset,104);assert.equal(report.updated,100);assert.deepEqual(report.skipped.sort(),['2','3','4']);
 const profile=sqlite.prepare("SELECT * FROM attorney_profiles WHERE bar_number='0'").get();
 assert.equal(profile.practice_areas,'Family law, Judge');assert.equal(profile.photo_key,'saved-photo');assert.equal(profile.website,'https://court.test/');assert.equal(profile.bio,'Existing bio');assert.equal(profile.owner_id,'owner');assert.equal(profile.claimed_at,'claimed');
 assert.equal(report.backups.find(r=>r.bar==='0').practiceAreas,'Family law');
 for(const bar of ['staff','2','3','4'])assert.equal(sqlite.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get(bar),undefined);
 assert.equal(sqlite.prepare("SELECT photo_key FROM attorney_profiles WHERE bar_number='1'").get().photo_key,'other-photo');
 // A later owner correction must survive subsequent reads after the audit completes.
 sqlite.prepare("UPDATE attorney_profiles SET practice_areas='Litigation' WHERE bar_number='0'").run();await run(db);
 assert.equal(sqlite.prepare("SELECT practice_areas FROM attorney_profiles WHERE bar_number='0'").get().practice_areas,'Litigation');
 sqlite.close();
});
