import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

test('Clear shortlist removes every saved entry only for the signed-in account',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE shortlist(id TEXT,user_id TEXT,bar_number TEXT,created_at TEXT);CREATE TABLE attorneys(bar_number TEXT,name TEXT);CREATE TABLE attorney_profiles(bar_number TEXT,photo_key TEXT,practice_areas TEXT);INSERT INTO shortlist VALUES('1','owner','a',''),('2','owner','b',''),('3','other','c','');INSERT INTO attorneys VALUES('a','A'),('b','B'),('c','C');");
 let user='owner';const db={prepare(query){const statement=sql.prepare(query);let args=[];return {bind(...values){args=values;return this;},async run(){return {meta:statement.run(...args)};},async all(){return {results:statement.all(...args)};}};}};
 const context=vm.createContext({Response,Request,URL,console}),code=ts.transpileModule(fs.readFileSync('app/api/shortlist/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});const overrides={activeMembershipSQL:()=> '1',publicRecords:async rows=>rows,resolveAttorneyReference:async id=>id,publicAttorneyColumns:()=> 'a.bar_number',ownershipVerifiedColumn:()=> '0 AS ownership_verified',validAttorneyId:()=>true,rawDb:()=>db,clientIdentity:async()=>user?{user}:null};
 await mod.link(spec=>{const names=[...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].filter(match=>match[2]===spec).flatMap(match=>match[1].split(',').map(name=>name.trim()));return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,overrides[name]);},{context});});await mod.evaluate();
 const clear=(origin='https://lawvetter.test')=>mod.namespace.POST(new Request('https://lawvetter.test/api/shortlist',{method:'POST',headers:{origin},body:JSON.stringify({action:'clear',user:'other'})}));
 try{
  user='';
  const guestList=await mod.namespace.POST(new Request('https://lawvetter.test/api/shortlist',{method:'POST',headers:{origin:'https://lawvetter.test'},body:JSON.stringify({action:'list'})}));
  assert.equal(guestList.status,200);assert.deepEqual(await guestList.json(),{signedIn:false,attorneys:[]});assert.match(guestList.headers.get('Cache-Control'),/no-store/);
  for(const action of ['save','remove'])assert.equal((await mod.namespace.POST(new Request('https://lawvetter.test/api/shortlist',{method:'POST',body:JSON.stringify({action,bar:'a'})}))).status,401);
  assert.equal((await clear()).status,401);assert.equal(sql.prepare('SELECT count(*) n FROM shortlist').get().n,3);
  user='owner';assert.equal((await clear('https://elsewhere.test')).status,403);assert.equal(sql.prepare('SELECT count(*) n FROM shortlist').get().n,3);
  const response=await clear();assert.equal(response.status,200);assert.deepEqual((await response.json()).attorneys,[]);assert.equal(sql.prepare("SELECT count(*) n FROM shortlist WHERE user_id='owner'").get().n,0);assert.equal(sql.prepare("SELECT count(*) n FROM shortlist WHERE user_id='other'").get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM attorneys').get().n,3);
  assert.equal((await clear()).status,200,'Clearing an empty shortlist is safe');
 }finally{sql.close();}
});
