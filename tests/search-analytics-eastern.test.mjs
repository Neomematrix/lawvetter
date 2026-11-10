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
const time=await load('db/search-analytics-time.ts');
const reports=await load('db/search-referrals.ts');
function fixture(events=[],searches=[]){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(`CREATE TABLE search_referral_visits(event_key TEXT PRIMARY KEY,source TEXT,bar_number TEXT,created_at TEXT);CREATE TABLE attorney_search_events(bar_number TEXT,created_at TEXT);CREATE TABLE attorneys(bar_number TEXT PRIMARY KEY,name TEXT);CREATE TABLE attorney_profiles(bar_number TEXT,photo_key TEXT);INSERT INTO attorneys VALUES('123','Example Lawyer');`);
 events.forEach(([source,created_at,bar='123'],i)=>sqlite.prepare('INSERT INTO search_referral_visits VALUES(?,?,?,?)').run(String(i),source,bar,created_at));
 searches.forEach(created_at=>sqlite.prepare('INSERT INTO attorney_search_events VALUES(?,?)').run('123',created_at));
 const db={prepare(sql){const statement=sqlite.prepare(sql);return {bind(...args){return {first:async()=>statement.get(...args),all:async()=>({results:statement.all(...args)}),run:async()=>statement.run(...args)};},run:async()=>statement.run()};}};
 const snapshot=()=>JSON.stringify(sqlite.prepare('SELECT * FROM search_referral_visits ORDER BY event_key').all());
 return {sqlite,db,snapshot};
}
test('Eastern dates cross midnight at 04:00Z in summer and 05:00Z in winter',()=>{
 for(const [before,after,previous,next] of [
  ['2026-10-29T03:59:59.999Z','2026-10-29T04:00:00.000Z','2026-10-28','2026-10-29'],
  ['2026-12-02T04:59:59.999Z','2026-12-02T05:00:00.000Z','2026-12-01','2026-12-02']
 ]){assert.equal(time.easternAnalyticsDay(before),previous);assert.equal(time.easternAnalyticsDay(after),next);assert.equal(time.easternAnalyticsMidnight(next),after);}
});
test('Eastern calendar buckets automatically cover 23-hour and 25-hour DST days',()=>{
 for(const [day,next,hours] of [['2026-03-08','2026-03-09',23],['2026-11-01','2026-11-02',25]]){
  assert.equal((Date.parse(time.easternAnalyticsMidnight(next))-Date.parse(time.easternAnalyticsMidnight(day)))/3600000,hours);
 }
});
test('reporting across Eastern midnight preserves visits, sums and Google/Bing profile breakdowns',async()=>{
 const f=fixture([
  ['google','2026-10-29T00:10:00.000Z'],['bing','2026-10-29T03:59:59.999Z'],
  ['google','2026-10-29T04:00:00.000Z'],['bing','2026-10-29T04:01:00.000Z','']
 ],['2026-10-29T03:59:59.999Z','2026-10-29T04:00:00.000Z']);
 const before=f.snapshot();f.sqlite.exec('PRAGMA query_only=ON');
 const yesterday=await reports.searchAnalyticsPeriod(f.db,'2026-10-28T04:00:00.000Z','2026-10-29T03:59:59.999Z');
 assert.equal(yesterday.trend.length,1);assert.equal(yesterday.trend[0].day,'2026-10-28');assert.equal(yesterday.google,1);assert.equal(yesterday.bing,1);
 const midnight=await reports.searchAnalyticsPeriod(f.db,'2026-10-28T04:00:00.000Z','2026-10-29T04:00:00.000Z');
 assert.deepEqual(JSON.parse(JSON.stringify(midnight.trend)),[
  {day:'2026-10-28',internal:1,google:1,bing:1,inProgress:false},
  {day:'2026-10-29',internal:1,google:1,bing:0,inProgress:true}
 ]);
 const after=await reports.searchAnalyticsPeriod(f.db,'2026-10-28T04:00:00.000Z','2026-10-29T04:01:00.000Z');
 assert.equal(after.google,2);assert.equal(after.bing,2);assert.equal(after.attorneys[0].google,2);assert.equal(after.attorneys[0].bing,1,'sitewide visits do not inflate profile counts');
 for(const key of ['google','bing'])assert.equal(after.trend.reduce((n,r)=>n+r[key],0),after[key]);
 assert.equal(after.trend.reduce((n,r)=>n+r.internal,0),after.internalTotal);assert.equal(f.snapshot(),before);f.sqlite.close();
});
test('spring skipped hour and fall repeated hour count every recorded event exactly once',async()=>{
 for(const [start,end,stamps] of [
  ['2026-03-08T05:00:00.000Z','2026-03-09T04:00:00.000Z',['2026-03-08T06:59:59.999Z','2026-03-08T07:00:00.000Z','2026-03-09T03:59:59.999Z']],
  ['2026-11-01T04:00:00.000Z','2026-11-02T05:00:00.000Z',['2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z','2026-11-02T04:59:59.999Z']]
 ]){
  const f=fixture(stamps.map((stamp,i)=>[i===1?'bing':'google',stamp]),stamps);f.sqlite.exec('PRAGMA query_only=ON');
  const r=await reports.searchAnalyticsPeriod(f.db,start,end);
  assert.equal(r.trend[0].google,2);assert.equal(r.trend[0].bing,1);assert.equal(r.trend[0].internal,3);
  assert.equal(r.trend[1].google+r.trend[1].bing+r.trend[1].internal,0);f.sqlite.close();
 }
});
test('empty days, partial rolling windows, 31-day months and year boundaries retain exact totals',async()=>{
 const f=fixture([['google','2026-10-01T04:00:00.000Z'],['bing','2026-11-01T03:59:59.999Z']]);f.sqlite.exec('PRAGMA query_only=ON');
 const month=await reports.searchAnalyticsPeriod(f.db,'2026-10-01T04:00:00.000Z','2026-11-01T03:59:59.999Z');
 assert.equal(month.trend.length,31);assert.equal(month.google,1);assert.equal(month.bing,1);assert.equal(month.trend[1].google,0);
 const partial=await reports.searchAnalyticsPeriod(f.db,'2026-10-01T04:00:00.001Z','2026-11-01T03:59:59.999Z');assert.equal(partial.google,0);assert.equal(partial.bing,1);
 const year=time.easternAnalyticsBuckets('2026-12-31T05:00:00.000Z','2027-01-01T05:00:00.000Z');assert.equal(year[1].day,'2027-01-01');f.sqlite.close();
});
test('chart keeps today outside solid history and renders dashed series and labeled endpoints',async()=>{
 const jsx=(type,props)=>({type,props});
 const {default:Trend}=await load('app/admin/searches/SearchTrafficTrend.tsx',{
  react:{useEffect(){},useState(){}},'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
  '../../FirmLink':{FirmLink(){}},'../../attorney-photo':{attorneyPhoto(){}},'../../seo':{attorneyPath(){}},'./search-analytics.css':{}
 });
 const rows=[{day:'2026-10-28',internal:3,google:9,bing:1,inProgress:false},{day:'2026-10-29',internal:0,google:0,bing:0,inProgress:true}];
 function nodes(node){if(!node||typeof node!=='object')return [];return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
 const all=nodes(Trend({rows}));
 for(const key of ['internal','google','bing']){
  const solid=all.find(n=>n.props?.['data-completed-series']===key),dashed=all.find(n=>n.props?.['data-in-progress-series']===key);
  assert.equal(solid.props.points.split(' ').length,1);assert.equal(dashed.props.points.split(' ').length,2);assert.equal(dashed.props.strokeDasharray,'6 5');
 }
 assert.ok(all.some(n=>n.type==='text'&&n.props.children==='Today (in progress)'));assert.equal(all.filter(n=>n.type==='circle').length,3);
 const one=nodes(Trend({rows:[rows[1]]}));assert.ok(one.filter(n=>n.type==='circle').every(n=>Number.isFinite(n.props.cx)&&Number.isFinite(n.props.cy)));
});
test('existing referral endpoint still excludes bots/admins and deduplicates Google/Bing visits',async()=>{
 const f=fixture();let admin=false;
 const {POST}=await load('app/api/search-referrals/route.ts',{
  '../../../db/raw':{rawDb:()=>f.db},'../../../db/firm-access':{firmRecord:async()=>null},'../../../db/profile-access':{profileIdentity:async()=>({admin})},
  '../../../db/directory-protection':{allowDirectoryAttempt:async()=>true},'../../../db/inquiry-metrics':{visitorPattern:/^[a-z0-9-]+$/},
  '../../../db/client-auth':{digest:value=>createHash('sha256').update(value).digest('hex')}
 });
 const request=(engine,agent='Mozilla/5.0')=>new Request('https://lawvetter.com/api/search-referrals',{method:'POST',headers:{origin:'https://lawvetter.com','user-agent':agent},body:JSON.stringify({visitorId:'visitor-123',referrer:`https://www.${engine}.com/search?q=lawyer`,landing:'https://lawvetter.com/attorney?bar=123'})});
 await POST(request('google','Googlebot'));admin=true;await POST(request('google'));admin=false;assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM search_referral_visits').get().n,0);
 for(const engine of ['google','google','bing','bing'])assert.equal((await POST(request(engine))).status,204);
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM search_referral_visits').get().n,2);f.sqlite.close();
});
