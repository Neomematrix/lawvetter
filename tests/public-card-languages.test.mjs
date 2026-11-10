import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
function setup(){let now=1000000;class Clock extends Date{static now(){return now;}}const cache={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('db/public-read-cache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{...cache,Date:Clock,Promise});const out={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('db/public-card-languages.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...out,require:spec=>spec.includes('read-json')?{readDeadline:work=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Read timed out')),20);work.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});})}:cache.exports,console:{warn(){}}});return {read:out.exports.refreshCardLanguages,advance(){now+=61000;}};}
test('Old ranking snapshots refresh languages and practice areas together, including cleared selections',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE attorneys(public_id TEXT,bar_number TEXT);CREATE TABLE attorney_profiles(bar_number TEXT,languages TEXT,practice_areas TEXT,owner_id TEXT,claimed_at TEXT);INSERT INTO attorneys VALUES('abc','internal'),('def','unselected');INSERT INTO attorney_profiles VALUES('internal','English, Spanish','Consumer','owner','now');");let calls=0;
 const db={prepare(query){return {bind(ids){return {async all(){calls++;return {results:sql.prepare(query).all(ids)};}};}};}};
 const x=setup(),row={public_id:'abc',bar_number:'LVabc',name:'Jose',practice_areas:''},other={public_id:'def',bar_number:'LVdef',practice_areas:'Family law'},data={popular:[row,other],weekly:[row],monthly:[],updated:'old'};
 try{const [a,b]=await Promise.all([x.read(db,data),x.read(db,data)]);assert.equal(calls,1);assert.equal(a.popular[0].languages,'English, Spanish');assert.equal(a.popular[0].ownership_verified,1);assert.equal(a.weekly[0].languages,'English, Spanish');assert.equal(a.weekly[0].practice_areas,'Consumer');assert.equal(a.popular[1].practice_areas,'Family law');assert.equal(a.popular[1].languages,'');assert.equal(data.popular[0].languages,undefined);assert.equal(b.popular[0].languages,a.popular[0].languages);sql.exec("UPDATE attorney_profiles SET languages='',practice_areas=''");x.advance();assert.equal((await x.read(db,data)).popular[0].languages,'');assert.equal(calls,2);assert.equal((await x.read(db,data)).weekly[0].practice_areas,'');}finally{sql.close();}
});
test('Card field enrichment failure preserves the usable ranking snapshot',async()=>{const x=setup(),data={popular:[{bar_number:'LVabc'}],weekly:[],monthly:[]};assert.equal(await x.read({prepare(){throw Error('Unavailable');}},data),data);});

test('stalled card reads return the snapshot promptly and a later read can recover',async()=>{
 const x=setup(),data={popular:[{public_id:'abc',bar_number:'LVabc',practice_areas:'Consumer'}],weekly:[],monthly:[]};let stalled=true;
 const db={prepare(){return {bind(){return {all(){return stalled?new Promise(()=>{}):Promise.resolve({results:[{public_id:'abc',languages:'English',practice_areas:'Family law'}]});}};}};}};
 assert.equal(await x.read(db,data),data);stalled=false;
 assert.equal((await x.read(db,data)).popular[0].practice_areas,'Family law');
});
