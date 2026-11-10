import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

test('Firm pages use the latest approved biography and exclude pending descriptions and private ownership notes',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE firm_settings(key TEXT,biography TEXT);CREATE TABLE directory_submissions(kind TEXT,status TEXT,name TEXT,notes TEXT,reviewed_at TEXT,submitted_at TEXT)');
 const db={prepare:sql=>({bind:(...args)=>({first:async()=>sqlite.prepare(sql).get(...args)||null})})};
 const cache=new Map();
 async function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const mod=new vm.SourceTextModule(code);cache.set(file,mod);await mod.link(async spec=>{if(spec==='./raw'){return new vm.SyntheticModule(['rawDb'],function(){this.setExport('rawDb',()=>db);});}return load(path.resolve(path.dirname(file),spec+'.ts'));});await mod.evaluate();return mod;}
 const module=await load('db/submitted-firm.ts'),details=(await load('db/directory-details.ts')).namespace;
 const insert=(kind,status,notes,date)=>sqlite.prepare('INSERT INTO directory_submissions VALUES(?,?,?,?,?,?)').run(kind,status,'Example Firm',notes,date,date);
 insert('firm','published','Legacy firm description.','2026-01-01');
 assert.equal(await module.namespace.publishedFirmBiography('examplefirm'),'Legacy firm description.');
 insert('firm','published',details.withDirectoryDetails('Internal submission notes',{biography:'First paragraph.\n\nSecond paragraph.'}),'2026-02-01');
 insert('firm','pending',details.withDirectoryDetails('',{biography:'Unapproved biography'}),'2026-03-01');
 insert('lawyer','published','Private attorney notes','2026-04-01');
 assert.equal(await module.namespace.publishedFirmBiography('examplefirm'),'First paragraph.\n\nSecond paragraph.');
 insert('firm','published','Firm ownership review request. Private proof of authority.','2026-05-01');
 assert.equal(await module.namespace.publishedFirmBiography('examplefirm'),'');
 assert.equal(await module.namespace.publishedFirmBiography('otherfirm'),'');sqlite.close();
});
