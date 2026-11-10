import {runtime} from './employment-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

test('Lawyer name searches exclude firm-only matches and rank Jack before Jackson',async()=>{
 const code=ts.transpileModule(fs.readFileSync('app/api/attorneys/search.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(()=>{});await mod.evaluate();
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE attorneys(name TEXT,company TEXT,bar_number TEXT,license_number TEXT,state TEXT)');
 for(const [i,name,firm] of [[1,'Alan Jackson',''],[2,'Alvin McCuller','Jack Legal'],[3,'Jack Kerdasha','Other Firm'],[4,'Aimee Jack Hall','Other Firm'],[5,'Andrew Fawbush Jr.','Jackson Firm']])db.prepare('INSERT INTO attorneys VALUES(?,?,?,?,?)').run(name,firm,String(i),String(i),'GA');
 db.exec("ALTER TABLE attorneys ADD COLUMN employer_name TEXT NOT NULL DEFAULT ''; ALTER TABLE attorneys ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'Law Firm Attorney'");
 const search=(q,includeCompany=false)=>{const s=mod.namespace.attorneyNameSearch(q,'','prefix',includeCompany);return db.prepare('SELECT name FROM attorneys WHERE '+s.where+' ORDER BY '+s.order+'name').all(...s.args,...s.orderArgs).map(r=>r.name);};
 try{
  assert.deepEqual(search('jack'),['Jack Kerdasha','Aimee Jack Hall','Alan Jackson']);
  assert.deepEqual(search('Jack Ker'),['Jack Kerdasha']);
  assert.deepEqual(search('jack missing'),[]);
  assert.deepEqual(search('jack %'),[]);
  assert.ok(search('jack',true).includes('Alvin McCuller'),'Existing administrative mixed searches remain supported');
  assert.deepEqual(search('GA:3'),['Jack Kerdasha']);
 }finally{db.close();}
});

test('Search API returns only lawyers in Lawyers mode and only firms in Firms mode',async()=>{
 const x=await runtime(),sql=x.sql;
 for(const [bar,name,company,city] of [['1','Jack Kerdasha','Other Firm','Atlanta'],['2','Andrew Fawbush Jr.','Jack Legal','Jacksonville'],['3','Aimee Jack Hall','Other Firm','Macon'],['4','Alan Jackson','','Atlanta']]){x.seed(bar,name,company);sql.prepare('UPDATE attorneys SET city=? WHERE bar_number=?').run(city,bar);}
 const mod={namespace:await x.load('app/api/attorneys/route.ts')};
 const get=async params=>{const response=await mod.namespace.GET(new Request('https://lawvetter.test/api/attorneys?'+new URLSearchParams(params)));assert.equal(response.status,200);return response.json();};
 try{
  let result=await get({q:'jack',kind:'attorneys'});assert.equal(result.total,3);assert.deepEqual(result.attorneys.map(a=>a.name),['Jack Kerdasha','Aimee Jack Hall','Alan Jackson']);assert.deepEqual(result.firms,[]);
  result=await get({q:'jack',kind:'firms'});assert.equal(result.total,1);assert.equal(result.firms[0].name,'Jack Legal');assert.equal(result.attorneys,undefined);
  result=await get({q:'jack',kind:'attorneys',city:'Macon'});assert.equal(result.total,1);assert.equal(result.attorneys[0].name,'Aimee Jack Hall');
  result=await get({q:'jack missing',kind:'attorneys'});assert.equal(result.total,0);assert.deepEqual(result.attorneys,[]);
  result=await get({q:'jack',kind:'attorneys',suggest:'1'});assert.equal(result.attorneys[0].name,'Jack Kerdasha');assert.equal(result.firms,undefined);
 }finally{sql.close();}
});
