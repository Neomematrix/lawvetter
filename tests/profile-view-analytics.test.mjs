import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import ts from 'typescript';

async function load(file,mocks={}){
 const context=vm.createContext({Date,Intl,URL,Request,Response,AbortSignal,console}),cache=new Map();
 async function module(file){
  if(cache.has(file))return cache.get(file);
  let mod;
  if(file in mocks){const values=mocks[file];mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});}
  else{const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;mod=new vm.SourceTextModule(code,{context});}
  cache.set(file,mod);await mod.link(spec=>module(spec in mocks?spec:path.resolve(path.dirname(file),spec+'.ts')));await mod.evaluate();return mod;
 }
 return (await module(path.resolve(file))).namespace;
}
const {profileViewAnalytics}=await load('db/profile-view-analytics.ts');
test('profile views include both entity types, respect date bounds, and keep Eastern daily totals consistent',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE directory_page_views(event_id TEXT PRIMARY KEY,target_kind TEXT,target_key TEXT,created_at TEXT);CREATE TABLE attorneys(bar_number TEXT PRIMARY KEY,name TEXT,company TEXT);CREATE TABLE attorney_profiles(bar_number TEXT,photo_key TEXT);CREATE TABLE firm_settings(key TEXT PRIMARY KEY,name TEXT);INSERT INTO attorneys VALUES('123','Example Lawyer','Example Firm LLC');`);
 const insert=sql.prepare('INSERT INTO directory_page_views VALUES(?,?,?,?)');
 insert.run('old','attorney','123','2026-10-27T12:00:00.000Z');
 insert.run('a','attorney','123','2026-10-29T03:59:59.000Z');
 insert.run('b','firm','examplefirmllc','2026-10-29T04:00:00.000Z');
 insert.run('c','attorney','123','2026-10-29T05:00:00.000Z');
 insert.run('future','firm','examplefirmllc','2026-10-30T05:00:00.000Z');
 const db={prepare(query){const s=sql.prepare(query);return {bind(...args){return {first:async()=>s.get(...args),all:async()=>({results:s.all(...args)})};}};}};
 sql.exec('PRAGMA query_only=ON');
 const r=await profileViewAnalytics(db,'2026-10-28T04:00:00.000Z','2026-10-29T12:00:00.000Z');
 assert.equal(r.total,3);assert.equal(r.attorneyTotal,2);assert.equal(r.firmTotal,1);assert.equal(r.attorneys[0].views,2);assert.equal(r.firms[0].name,'Example Firm LLC');
 assert.deepEqual(JSON.parse(JSON.stringify(r.trend)),[{day:'2026-10-28',views:1,inProgress:false},{day:'2026-10-29',views:2,inProgress:true}]);
 assert.equal(r.trend.reduce((n,d)=>n+d.views,0),r.total);
 const empty=await profileViewAnalytics(db,'2026-10-26T04:00:00.000Z','2026-10-26T12:00:00.000Z');assert.equal(empty.total,0);assert.equal(empty.attorneys.length,0);assert.equal(empty.trend[0].views,0);sql.close();
});
