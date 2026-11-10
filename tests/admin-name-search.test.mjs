import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

test('Admin name search keeps partial surnames across omitted middle names',async()=>{
 const code=ts.transpileModule(fs.readFileSync('app/api/attorneys/search.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(()=>{});await mod.evaluate();
 const {attorneyNameSearch}=mod.namespace,db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE attorneys(name TEXT,company TEXT,bar_number TEXT,license_number TEXT)');
 for(const [name,bar,company] of [['Brennan John McElhone','238455','Royal & Cross LLC'],['Brennan Lee Mancil','170596',''],['Theodore S Eittreim','231458',''],['United Counsel','999999','']])db.prepare('INSERT INTO attorneys VALUES(?,?,?,?)').run(name,company,bar,bar);
 db.exec('ALTER TABLE attorneys ADD COLUMN public_id TEXT');
 db.prepare('UPDATE attorneys SET public_id=? WHERE bar_number=?').run('f846e5fdc2765476d298dd3109304055','238455');
 db.exec("ALTER TABLE attorneys ADD COLUMN employer_name TEXT NOT NULL DEFAULT ''; ALTER TABLE attorneys ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'Law Firm Attorney'");
 const find=(q,match='prefix')=>{const s=attorneyNameSearch(q.toLowerCase(),'a.',match);return db.prepare('SELECT name FROM attorneys a WHERE '+s.where).all(...s.args).map(r=>r.name);};
 try{
  for(const q of ['brennan m','brennan mc','brennan mce','Brennan McElhone','mc brennan','  brennan   mc  '])assert.ok(find(q).includes('Brennan John McElhone'),q);
  assert.deepEqual(find('brennan mc'),['Brennan John McElhone']);
  assert.deepEqual(find('brennan zz'),[]);
  assert.deepEqual(find('238455'),['Brennan John McElhone']);
  assert.deepEqual(find('LVf846e5fdc2765476d298dd3109304055'),['Brennan John McElhone']);
  assert.deepEqual(find('lvF846E5FDC2765476D298DD3109304055'),['Brennan John McElhone']);
  assert.deepEqual(find('LV00000000000000000000000000000000'),[]);
  assert.deepEqual(find('ted'),['Theodore S Eittreim']);
  assert.deepEqual(find('brennan %'),[]);
  assert.deepEqual(find('brennan mc','whole'),[]);
  assert.match(fs.readFileSync('app/api/admin/records/route.ts','utf8'),/attorneyNameSearch\(q\.toLowerCase\(\),'a\.','prefix'\)/);
 }finally{db.close();}
});
