import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';import path from 'node:path';
async function modules(){const cache=new Map();async function module(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,{identifier:path.resolve(file)});cache.set(file,m);return m;}const m=await module('db/search-index.ts');await m.link((spec,parent)=>module(path.resolve(path.dirname(parent.identifier),spec)+'.ts'));await m.evaluate();return m.namespace;}
function database(beforeLast=false){const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){if(beforeLast&&file.startsWith('0051'))continue;sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));}return sql;}
function d1(sql){return {prepare(query){let args=[];const p={bind(...a){args=a;return p;},async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);},async all(){return {results:sql.prepare(query).all(...args)};},exec(){sql.prepare(query).run(...args);}};return p;},async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>s.exec());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
function insert(sql,bar,name,company=''){sql.prepare("INSERT INTO attorneys(bar_number,source_id,name,company,status,source_url,imported_at) VALUES(?,?,?,?,'Member in Good Standing','','')").run(bar,bar,name,company);}
test('bounded resumable backfill remains unready until all rows are indexed; triggers cover live changes',async()=>{
 const sql=database(true);for(let i=0;i<1101;i++)insert(sql,''+i,'Attorney '+i);
 sql.exec(fs.readFileSync('drizzle/0051_cheerful_gargoyle.sql','utf8'));const x=await modules(),db=d1(sql);
 assert.equal(await x.searchIndexReady(db),false);let p=await x.buildSearchIndexBatch(db);assert.equal(p.attorney_cursor,500);assert.equal(p.ready,0);
 sql.prepare('UPDATE attorneys SET name=? WHERE bar_number=?').run('Edited Attorney','0');insert(sql,'new','New Attorney');sql.exec("DELETE FROM attorneys WHERE bar_number='1'");
 p=await x.buildSearchIndexBatch(db);assert.equal(p.ready,0);p=await x.buildSearchIndexBatch(db);assert.equal(p.ready,1);
 assert.equal(sql.prepare('SELECT count(*) n FROM attorney_search_fts').get().n,1101);
 assert.equal(sql.prepare("SELECT count(*) n FROM attorney_search_fts WHERE attorney_search_fts MATCH 'name : Edited'").get().n,1);
 await x.buildSearchIndexBatch(db);assert.equal(sql.prepare('SELECT count(*) n FROM attorney_search_fts').get().n,1101);
 sql.close();
});
test('indexed candidates preserve nickname, substring, apostrophe, license and employer matches',async()=>{
 const sql=database(),x=await modules();insert(sql,'231458','Theodore Scott Eittreim','Example Legal');insert(sql,'2',"Anne O’Connor",'Smith & Partners');insert(sql,'3','John McClure','Legal Associates');insert(sql,'4','David Perez','');sql.exec("UPDATE attorneys SET employer_name='The Coca-Cola Company',employment_type='In House Counsel' WHERE bar_number='4'");
 for(const [query,expected] of [['Ted Eittreim','231458'],['O’Connor','2'],['McCl','3'],['coca','4']]){const f=x.nameIndexFilter(query,true);assert.ok(sql.prepare('SELECT bar_number FROM attorneys WHERE '+f.where).all(...f.args).some(r=>r.bar_number===expected),query);}
 const f=x.nameIndexFilter('GA:231458',false);assert.ok(sql.prepare('SELECT bar_number FROM attorneys WHERE '+f.where).all(...f.args).some(r=>r.bar_number==='231458'));
 insert(sql,'GA:LVabc123','Synthetic License Attorney');const legacy=x.nameIndexFilter('ga:lvabc123',false);assert.equal(sql.prepare('SELECT bar_number FROM attorneys WHERE '+legacy.where).get(...legacy.args).bar_number,'GA:LVabc123');
 assert.equal(x.nameIndexFilter('Li',false),null);
 sql.prepare("INSERT INTO firm_settings(key,name,updated_at) VALUES(?,?,'now')").run('smithandpartners','Smith & Partners');
 for(const standalone of [false,true]){const f=x.firmIndexFilter('mith','mith',standalone);assert.equal(sql.prepare('SELECT count(*) n FROM '+(standalone?'firm_settings f':'attorneys')+' WHERE '+f.where).get(...f.args).n,1);}
 sql.exec("UPDATE firm_settings SET name='New Firm',key='newfirm'; DELETE FROM attorneys WHERE bar_number='2'");assert.equal(sql.prepare("SELECT count(*) n FROM firm_search_fts WHERE firm_search_fts MATCH 'name : Smith'").get().n,0);
 assert.equal(sql.prepare('SELECT count(*) n FROM attorney_search_fts').get().n,4);sql.close();
});
test('selective name candidates use the FTS and primary key instead of scanning attorneys',async()=>{
 const sql=database(),x=await modules();insert(sql,'target','Jane Example');const f=x.nameIndexFilter('Jane Example',true);
 const plan=sql.prepare('EXPLAIN QUERY PLAN SELECT count(*) FROM attorneys WHERE '+f.where).all(...f.args).map(r=>r.detail).join('\n');assert.match(plan,/VIRTUAL TABLE INDEX/);assert.match(plan,/SEARCH attorneys USING INTEGER PRIMARY KEY/);assert.doesNotMatch(plan,/SCAN attorneys/);sql.close();
});
