import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const source="function firmColumn(){return 'a.company'}\n"+fs.readFileSync('db/ranking-activity.ts','utf8').replace(/^import .*;$/gm,'').split('export const firmTotalRankingActivitySQL')[0]+'\n'+fs.readFileSync('app/awards/core.ts','utf8')+'\n'+fs.readFileSync('db/monthly-awards.ts','utf8').replace(/^import .*;$/gm,'')+`\nfunction rawDb(){throw Error('explicit database required')} function activeMembershipSQL(){return "lower(trim(a.status))='active'"} function attorneyPath(a){return '/lawyers/'+a.public_id}`;
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const m=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('New York month boundary, daylight saving time and year rollover',()=>{
 assert.equal(m.currentMonth(new Date('2026-11-01T03:59:59Z')),'2026-10');
 assert.equal(m.currentMonth(new Date('2026-11-01T04:00:00Z')),'2026-11');
 assert.equal(m.monthBoundary('2026-11'),'2026-11-01T04:00:00.000Z');
 assert.equal(m.monthBoundary('2026-12'),'2026-12-01T05:00:00.000Z');
 assert.equal(m.nextMonth('2026-12'),'2027-01');assert.equal(m.validMonth('2026-13'),false);
});
test('closed months only, deterministic ties, inactive exclusion, exclusive end and immutable snapshots',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE attorneys(bar_number TEXT,public_id TEXT,name TEXT,company TEXT,city TEXT,state TEXT,status TEXT);CREATE TABLE attorney_search_events(event_id TEXT,bar_number TEXT,created_at TEXT);CREATE TABLE search_referral_visits(event_key TEXT,source TEXT,bar_number TEXT,created_at TEXT);CREATE TABLE directory_page_views(event_id TEXT,target_kind TEXT,target_key TEXT,source TEXT,created_at TEXT);'+fs.readFileSync('drizzle/0034_closed_black_queen.sql','utf8'));
 for(const [id,name,status] of [['1','Zoe Lawyer','active'],['2','Amy Lawyer','active'],['3','Inactive Lawyer','inactive']])sql.prepare('INSERT INTO attorneys VALUES(?,?,?,?,?,?,?)').run(id,id,name,'Law Firm','Atlanta','GA',status);
 for(const id of ['1','2','3','3'])sql.prepare('INSERT INTO attorney_search_events(bar_number,created_at) VALUES(?,?)').run(id,'2026-10-10T12:00:00.000Z');
 sql.prepare('INSERT INTO attorney_search_events(bar_number,created_at) VALUES(?,?)').run('1','2026-11-01T04:00:00.000Z');
 const db={prepare(q){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(q).all(...args)}},async first(){return sql.prepare(q).get(...args)},async run(){return sql.prepare(q).run(...args)}}}};
 await m.finalizeClosedAwards(db,new Date('2026-10-31T12:00:00Z'));assert.equal(sql.prepare('SELECT count(*) n FROM monthly_awards').get().n,0);
 await m.finalizeClosedAwards(db,new Date('2026-11-01T04:00:00Z'));let first=sql.prepare('SELECT payload FROM monthly_awards').get().payload;assert.equal(JSON.parse(first).name,'Amy Lawyer');
 sql.exec("UPDATE attorneys SET name='Changed' WHERE bar_number='2'; DELETE FROM attorney_search_events;");
 await m.finalizeClosedAwards(db,new Date('2026-12-01T05:00:00Z'));assert.equal(sql.prepare("SELECT payload FROM monthly_awards WHERE month='2026-10'").get().payload,first);assert.equal(sql.prepare("SELECT payload FROM monthly_awards WHERE month='2026-11'").get().payload,null);
});

test('award finalization coalesces readers and skips repeated work until the Eastern month changes',async()=>{
 let checks=0;const db={prepare(){checks++;return {async all(){return {results:[{month:'2026-10'},{month:'2026-11'}]};}};}};
 const november=new Date('2026-11-10T12:00:00Z');
 await Promise.all(Array.from({length:20},()=>m.finalizeClosedAwards(db,november)));await m.finalizeClosedAwards(db,november);assert.equal(checks,1);
 await m.finalizeClosedAwards(db,new Date('2026-12-01T05:00:00Z'));assert.equal(checks,2);
 let calls=0;const retry={prepare(){return {async all(){if(++calls===1)throw Error('overloaded');return {results:[]};}};}};
 await assert.rejects(m.finalizeClosedAwards(retry,new Date('2026-10-10')));
 await m.finalizeClosedAwards(retry,new Date('2026-10-10'));assert.equal(calls,2);
});
