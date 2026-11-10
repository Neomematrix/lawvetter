import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as nodeCrypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {webcrypto}=nodeCrypto,root=path.resolve('.'),adminTestToken='ab'.repeat(32),adminTestCookie='__Host-lawvetter-admin='+adminTestToken;
function database(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));const db={prepare(text){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){const x=sql.prepare(text).run(...args);return {meta:{changes:Number(x.changes)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {sql,db};}
async function runtime(options={}){const {sql,db}=database(),files=new Map();sql.prepare('INSERT INTO admin_credentials(email,password_hash,updated_at) VALUES(?,?,?)').run('admin@example.test','fixture-only','2026-01-01');sql.prepare('INSERT INTO admin_sessions(token_hash,email,expires_at,last_seen) VALUES(?,?,?,?)').run(nodeCrypto.createHash('sha256').update(adminTestToken).digest('hex'),'admin@example.test',Date.now()+3600000,Date.now());const env={DB:db,CLAIM_ADMIN_EMAIL:'admin@example.test',PROFILE_PHOTOS:{async put(key,buffer,metadata){files.set(key,{body:buffer,...metadata});},async get(key){return files.get(key)},async delete(key){files.delete(key)}}};const context=vm.createContext({structuredClone,setTimeout,clearTimeout,console,Request,Response,URL,File,FormData,Uint8Array,Buffer,Date,Intl,TextEncoder,TextDecoder,btoa,atob,crypto:webcrypto,AbortSignal,fetch:options.fetch});const cache=new Map();async function module(file){if(cache.has(file))return cache.get(file);if(file.endsWith('.json.ts')){const m=new vm.SyntheticModule(['default'],function(){this.setExport('default',JSON.parse(fs.readFileSync(file.slice(0,-3),'utf8')))},{context});cache.set(file,m);return m;}if(file==='node:crypto'){const m=new vm.SyntheticModule(Object.keys(nodeCrypto),function(){for(const [k,v] of Object.entries(nodeCrypto))this.setExport(k,v)},{context});cache.set(file,m);return m;}if(file==='cloudflare:workers'){const m=new vm.SyntheticModule(['env'],function(){this.setExport('env',env)},{context});cache.set(file,m);return m;}const text=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const m=new vm.SourceTextModule(text,{context,identifier:file});cache.set(file,m);return m;}async function load(file){const m=await module(path.join(root,file));if(m.status==='unlinked')await m.link(async(spec,parent)=>module((spec==='cloudflare:workers'||spec==='node:crypto')?spec:path.resolve(path.dirname(parent.identifier),spec)+'.ts'));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}function seed(bar,name,company='Example Legal LLC',status='Active Member in Good Standing'){sql.prepare('INSERT INTO attorneys(bar_number,source_id,name,company,city,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run(bar,bar,name,company,'Atlanta',status,'https://example.test/record','2026-10-08T00:00:00Z');}return {sql,db,load,seed,files,env};}

const publicId='a'.repeat(32),visitor=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function arrival({id=1,landing='/lawyers/example-lawyer-lv-'+publicId,referrer='https://www.google.com/search?q=lawyer',agent='Mozilla/5.0',cookie=''}={}){return new Request('https://lawvetter.test/api/search-referrals',{method:'POST',headers:{origin:'https://lawvetter.test','content-type':'application/json','user-agent':agent,cookie},body:JSON.stringify({visitorId:visitor(id),landing,referrer})});}
function seed(x){x.seed('100001','Example Lawyer','Example Firm');x.sql.prepare('UPDATE attorneys SET public_id=? WHERE bar_number=?').run(publicId,'100001');}

test('five existing internal searches plus three Google profile arrivals equal eight without resetting history',async()=>{
 const x=await runtime();try{seed(x);const now=new Date().toISOString();for(let i=0;i<5;i++)x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('internal-'+i,'100001',now);
 const api=await x.load('app/api/search-referrals/route.ts'),charts=await x.load('app/api/attorneys/charts.ts');
 for(const id of [1,2,3,1])assert.equal((await api.POST(arrival({id}))).status,204);
 assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM attorney_search_events').get().n,5);
 assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM search_referral_visits WHERE source='google' AND bar_number='100001'").get().n,3);
 const end=new Date().toISOString(),rank=x.sql.prepare(charts.attorneyChartSQL).all('',end);assert.equal(rank.length,1);assert.equal(rank[0].searches,8);assert.equal(rank[0].rank,1);
 assert.equal(x.sql.prepare(charts.firmChartSQL).all('',end,'',end)[0].searches,8);
 // Old recorded Google arrivals are included as-is; they are never copied into internal searches.
 x.sql.prepare('INSERT INTO search_referral_visits VALUES(?,?,?,?)').run('previous-google','google','100001',now);
 assert.equal(x.sql.prepare(charts.attorneyChartSQL).all('',end)[0].searches,9);
 x.sql.exec("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES('owner','Owner','owner@example.test','now');INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES('100001','owner','now','now')");
 const auth=await x.load('db/client-auth.ts'),cookie='__Host-lawvetter-client='+await auth.newSession('owner'),insights=await x.load('app/api/account/insights/route.ts'),analytics=await x.load('app/api/account/analytics/route.ts');
 const ownerRequest=path=>new Request('https://lawvetter.test'+path,{headers:{cookie}}),counts=await(await insights.GET(ownerRequest('/api/account/insights?target=100001'))).json();assert.equal(counts.totals.searches,9);
 const owner=await(await analytics.GET(ownerRequest('/api/account/analytics'))).json();assert.equal(owner.profiles[0].monthly,9);assert.equal(owner.profiles[0].monthlyRank,1);

 }finally{x.sql.close();}
});

test('Google firm-profile arrivals count once and attorney arrivals also help the listed firm',async()=>{
 const x=await runtime();try{seed(x);const api=await x.load('app/api/search-referrals/route.ts'),charts=await x.load('app/api/attorneys/charts.ts');
 await api.POST(arrival());for(let i=0;i<2;i++)assert.equal((await api.POST(arrival({landing:'/firm?name=Example%20Firm'}))).status,204);
 const end=new Date().toISOString();assert.equal(x.sql.prepare(charts.firmChartSQL).all('',end,'',end)[0].searches,2);assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM google_firm_arrivals').get().n,1);
 x.sql.exec("INSERT INTO firm_settings(key,name,updated_at) VALUES('standalone','Standalone','now')");await api.POST(arrival({landing:'/firm?name=Standalone'}));assert.equal(x.sql.prepare(charts.firmChartSQL).all('',new Date().toISOString(),'',new Date().toISOString()).find(f=>f.firm_key==='standalone').searches,1);
 }finally{x.sql.close();}
});

test('ordinary browsing, direct links, Bing, bots, admin, view-as and lookalike search domains do not add Google ranking points',async()=>{
 const x=await runtime();try{seed(x);const api=await x.load('app/api/search-referrals/route.ts'),charts=await x.load('app/api/attorneys/charts.ts');
 for(const data of [{referrer:''},{referrer:'https://lawvetter.test/discover'},{referrer:'https://www.bing.com/search'},{referrer:'https://google.com.attacker.test/search'},{agent:'Googlebot'},{agent:'HeadlessChrome'},{cookie:adminTestCookie},{cookie:'__Host-lawvetter-view-as=fixture'},{landing:'/'}])assert.equal((await api.POST(arrival(data))).status,204);
 assert.equal((await api.POST(arrival({landing:'https://attacker.test/lawyers/a-lv-'+publicId}))).status,400);
 assert.equal(x.sql.prepare(charts.attorneyChartSQL).all('',new Date().toISOString()).length,0);
 assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM google_firm_arrivals').get().n,0);
 }finally{x.sql.close();}
});

test('legacy attorney links resolve, unknown profiles never rank, and date bounds and inactive exclusion still apply',async()=>{
 const x=await runtime();try{seed(x);const api=await x.load('app/api/search-referrals/route.ts'),charts=await x.load('app/api/attorneys/charts.ts');
 await api.POST(arrival({landing:'/attorney?bar=100001'}));await api.POST(arrival({id:2,landing:'/lawyers/100001-example-lawyer'}));await api.POST(arrival({id:3,landing:'/lawyers/missing-lv-'+('f'.repeat(32))}));
 const end=new Date().toISOString();assert.equal(x.sql.prepare(charts.attorneyChartSQL).all('',end)[0].searches,2);assert.equal(x.sql.prepare(charts.attorneyChartSQL).all('2099-01-01', '2099-02-01').length,0);
 x.sql.exec("UPDATE attorneys SET status='Inactive'");assert.equal(x.sql.prepare(charts.attorneyChartSQL).all('',end).length,0);
 }finally{x.sql.close();}
});

test('zero Google arrivals preserve the existing monthly spotlight and rank exactly',async()=>{
 const x=await runtime();try{seed(x);x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('existing-leader','100001',new Date().toISOString());const charts=await x.load('app/api/attorneys/charts.ts'),data=await charts.discoveryData(x.db,true);assert.equal(data.monthly[0].name,'Example Lawyer');assert.equal(data.monthly[0].rank,1);assert.equal(data.monthly[0].searches,1);assert.equal(data.weekly[0].searches,1);
 }finally{x.sql.close();}
});


test('taking ownership of the existing referral table preserves recorded Google history',()=>{
 const sql=new DatabaseSync(':memory:');try{sql.exec("CREATE TABLE search_referral_visits(event_key TEXT PRIMARY KEY,source TEXT NOT NULL,bar_number TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);CREATE INDEX search_referral_date ON search_referral_visits(created_at);INSERT INTO search_referral_visits VALUES('existing','google','123','2026-11-02T12:00:00.000Z')");sql.exec(fs.readFileSync('drizzle/0045_rapid_professor_monster.sql','utf8'));assert.equal(sql.prepare('SELECT COUNT(*) n FROM search_referral_visits').get().n,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM google_firm_arrivals').get().n,0);}finally{sql.close();}
});


test('historical Google-tagged attorney views restore missing November entries without counting other opens',async()=>{
 const x=await runtime();try{seed(x);x.seed('100002','Another Google Attorney');x.seed('100003','Ordinary Profile View');
 const insert=x.sql.prepare('INSERT INTO directory_page_views VALUES(?,?,?,?,?)');
 for(const id of ['old-google-1','old-google-2','old-google-3'])insert.run(id,'attorney','100001','google','2026-11-01T12:00:00.000Z');
 insert.run('other-lawyer','attorney','100002','google','2026-11-02T12:00:00.000Z');
 insert.run('not-google','attorney','100003','other','2026-11-02T12:00:00.000Z');
 insert.run('future-profile-only','attorney','100003','google','2026-11-04T12:00:00.000Z');
 const charts=await x.load('app/api/attorneys/charts.ts'),rows=x.sql.prepare(charts.attorneyChartSQL).all('2026-11-01T04:00:00.000Z','2026-11-05T00:00:00.000Z');
 assert.equal(rows.length,2);assert.equal(rows.find(r=>r.bar_number==='100001').searches,1);assert.equal(rows.find(r=>r.bar_number==='100002').searches,1);
 // Once a dedicated Google arrival exists for the same profile/day, history is not added again.
 x.sql.prepare('INSERT INTO search_referral_visits VALUES(?,?,?,?)').run('dedicated','google','100001','2026-11-01T12:00:00.100Z');
 assert.equal(x.sql.prepare(charts.attorneyChartSQL).all('', '2026-11-05T00:00:00.000Z').find(r=>r.bar_number==='100001').searches,1);
 }finally{x.sql.close();}
});

test('historical Google firm visits are recovered once, count alongside internal searches, and never duplicate mapped arrivals',async()=>{
 const x=await runtime();try{seed(x);x.sql.prepare('INSERT INTO firm_search_events VALUES(?,?,?,?)').run('internal-firm','examplefirm','Example Firm','2026-11-01T12:00:00.000Z');
 for(const id of ['firm-open-1','firm-open-2'])x.sql.prepare('INSERT INTO directory_page_views VALUES(?,?,?,?,?)').run(id,'firm','examplefirm','google','2026-11-01T13:00:00.000Z');
 const charts=await x.load('app/api/attorneys/charts.ts'),read=()=>x.sql.prepare(charts.firmChartSQL).all('', '2026-11-03T00:00:00.000Z','', '2026-11-03T00:00:00.000Z');
 assert.equal(read()[0].searches,2);
 x.sql.prepare('INSERT INTO google_firm_arrivals VALUES(?,?,?,?)').run('mapped-firm','examplefirm','Example Firm','2026-11-01T13:00:00.100Z');assert.equal(read()[0].searches,2);
 }finally{x.sql.close();}
});

test('firm chart uses indexed membership lookups while excluding unknown firms',async()=>{
 const x=await runtime();try{
 seed(x);x.sql.prepare('INSERT INTO firm_search_events VALUES(?,?,?,?)').run('known','examplefirm','Example Firm','2026-11-01T12:00:00.000Z');
 x.sql.prepare('INSERT INTO firm_search_events VALUES(?,?,?,?)').run('unknown','missingfirm','Missing Firm','2026-11-01T12:00:00.000Z');
 const charts=await x.load('app/api/attorneys/charts.ts'),bounds=['','2026-11-03','','2026-11-03'];
 const rows=x.sql.prepare(charts.firmChartSQL).all(...bounds);assert.equal(rows.length,1);assert.equal(rows[0].firm_key,'examplefirm');
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN '+charts.firmChartSQL).all(...bounds);assert.ok(plan.some(row=>/SEARCH current USING (?:COVERING )?INDEX attorneys_firm_key_idx/.test(row.detail)));assert.ok(!plan.some(row=>/SCAN current/.test(row.detail)));
 }finally{x.sql.close();}
});

test('firm ranking uses indexed normalized-name lookups and avoids correlated roster scans',async()=>{
 const x=await runtime();try{seed(x);x.seed('100002','Number Firm Lawyer','00123');x.seed('100003','Alias Lawyer','Thrift McLemore');
 for(const [id,key] of [['normal','examplefirm'],['numeric','00123'],['alias','thriftmclemorellc']])x.sql.prepare('INSERT INTO directory_page_views VALUES(?,?,?,?,?)').run(id,'firm',key,'google','2026-11-01T12:00:00.000Z');
 const {firmChartSQL}=await x.load('app/api/attorneys/charts.ts'),bounds=['2026-11-01T00:00:00.000Z','2026-11-03T00:00:00.000Z'],args=[...bounds,...bounds];
 const before=firmChartSQL.replaceAll('=+v.target_key','=v.target_key').replaceAll('=+firm_search_events.firm_key','=firm_search_events.firm_key');
 assert.deepEqual(x.sql.prepare(firmChartSQL).all(...args),x.sql.prepare(before).all(...args));
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN '+firmChartSQL).all(...args).map(row=>row.detail).join('\n');
 assert.match(plan,/SEARCH a USING INDEX attorneys_firm_key_idx/);assert.match(plan,/SEARCH current USING (?:COVERING )?INDEX attorneys_firm_key_idx/);assert.doesNotMatch(plan,/SCAN current/);assert.doesNotMatch(plan,/CORRELATED.*attorneys/);
 }finally{x.sql.close();}
});

test('large firm roster aggregates history once, preserving counts, ties, zero activity and pagination',async t=>{
 const x=await runtime();try{
 const stamp='2026-11-01T12:00:00.000Z',end='2026-11-03T00:00:00.000Z';
 for(let i=0;i<100;i++){
  const bar='R'+i;x.seed(bar,'Roster '+String(i).padStart(3,'0'),'Large Firm');
  if(i<90)for(let j=0;j<25;j++)x.sql.prepare('INSERT INTO directory_page_views VALUES(?,?,?,?,?)').run('legacy-'+i+'-'+j,'attorney',bar,'google',stamp);
  if(i%3===0)x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('internal-'+i,bar,stamp);
 }
 x.seed('OTHER','Other Attorney','Other Firm');
 x.sql.exec("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<50000) INSERT INTO directory_page_views SELECT 'ordinary-'||n,'attorney','OTHER','other','2026-10-01T00:00:00.000Z' FROM seq");
 const {attorneyRankingActivitySQL}=await x.load('db/ranking-activity.ts'),{firmRosterRankingSQL}=await x.load('db/firm-roster-ranking.ts');
 const fields='attorneys.bar_number,attorneys.name,attorneys.company',where='company=?';
 const old=`SELECT ${fields} FROM attorneys WHERE ${where} ORDER BY (SELECT count(*) FROM (${attorneyRankingActivitySQL}) e WHERE e.bar_number=attorneys.bar_number AND e.created_at>=? AND e.created_at<=?) DESC,name COLLATE NOCASE,bar_number LIMIT 50 OFFSET ?`;
 const optimized=firmRosterRankingSQL(fields,where,50),args=['Large Firm','',end,0];
 x.sql.exec('DROP INDEX directory_page_views_date_idx; DROP INDEX directory_page_views_source_date_idx');
 const start=performance.now(),expected=x.sql.prepare(old).all(...args),oldMs=performance.now()-start;
 x.sql.exec(fs.readFileSync('drizzle/0046_striped_yellow_claw.sql','utf8'));
 const next=performance.now(),actual=x.sql.prepare(optimized).all(...args),newMs=performance.now()-next;
 assert.deepEqual(actual,expected);
 assert.deepEqual(x.sql.prepare(optimized).all('Large Firm','',end,50),x.sql.prepare(old).all('Large Firm','',end,50));
 assert.deepEqual(x.sql.prepare(optimized).all('Missing Firm','',end,0),[]);
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN '+optimized).all(...args).map(row=>row.detail).join('\n');
 assert.match(plan,/MATERIALIZE roster/);assert.match(plan,/MATERIALIZE counts/);
 t.diagnostic(`100-attorney roster / 2,250 legacy + 50,000 ordinary views: before ${oldMs.toFixed(1)} ms; after ${newMs.toFixed(1)} ms`);
 }finally{x.sql.close();}
});

test('view analytics date filters use the new index instead of scanning all history',async()=>{
 const x=await runtime();try{
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN SELECT COUNT(*) FROM directory_page_views WHERE created_at>=? AND created_at<=?').all('2026-11-01','2026-11-03').map(row=>row.detail).join('\n');
 assert.match(plan,/SEARCH directory_page_views USING COVERING INDEX directory_page_views_date_idx/);
 assert.doesNotMatch(plan,/SCAN directory_page_views/);
 }finally{x.sql.close();}
});

test('practice catalogs and directory totals share concurrent reads, including empty results',async()=>{
 const x=await runtime();try{
 seed(x);x.sql.prepare('INSERT INTO site_settings VALUES(?,?,?)').run('judge-category-rollback-2026-10-18',JSON.stringify({status:'complete'}),'now');
 x.sql.prepare('INSERT INTO site_settings VALUES(?,?,?)').run('verified-judge-category-audit-2026-10-20',JSON.stringify({status:'complete'}),'now');
 const original=x.db.prepare.bind(x.db);let catalogs=0,totals=0;
 x.db.prepare=q=>{if(q.includes('SELECT p.bar_number,p.practice_areas'))catalogs++;if(q.includes('count(*) AS total,max(imported_at)'))totals++;return original(q);};
 const {practiceCatalog}=await x.load('db/practice-categories.ts'),{publicDirectoryStats}=await x.load('db/public-directory-stats.ts');
 await Promise.all(Array.from({length:10},()=>practiceCatalog(x.db)));await practiceCatalog(x.db);assert.equal(catalogs,1);
 const results=await Promise.all(Array.from({length:10},()=>publicDirectoryStats(x.db)));assert.equal(results[0].total,1);assert.equal(totals,1);
 }finally{x.sql.close();}
});

test('analytics authorize every read, coalesce refreshes, and handle database auth failures without leaking data',async()=>{
 const x=await runtime();try{
 seed(x);const api=await x.load('app/api/admin/searches/route.ts');
 const owner=()=>new Request('https://lawvetter.test/api/admin/searches',{headers:{cookie:adminTestCookie}});
 const a=await api.GET(owner());assert.equal(a.status,200);assert.equal(a.headers.get('Cache-Control'),'private, no-store');
 const old=x.db.prepare.bind(x.db);let expensive=0;
 x.db.prepare=q=>{if(q.includes('WITH counts AS')||q.includes('WITH known_firms'))expensive++;return old(q);};
 const results=await Promise.all([api.GET(owner()),api.GET(owner())]);assert.ok(results.every(r=>r.status===200));assert.equal(expensive,0);
 assert.equal((await api.GET(new Request(owner().url))).status,403);
 x.sql.exec('DELETE FROM admin_sessions');assert.equal((await api.GET(owner())).status,403);
 x.db.prepare=q=>{if(q.includes('FROM admin_sessions'))throw Error('D1_ERROR: D1 DB is overloaded');return old(q);};
 const unavailable=await api.GET(owner());assert.equal(unavailable.status,503);assert.match(unavailable.headers.get('Cache-Control'),/private, no-store/);
 }finally{x.sql.close();}
});

test('profile-view firm names use indexed lookups rather than scanning every attorney for each analytics row',async t=>{
 const x=await runtime();try{
 x.sql.exec("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<10000) INSERT INTO attorneys(bar_number,source_id,name,company,city,status,source_url,imported_at) SELECT 'bulk-'||n,'bulk-'||n,'Bulk Lawyer '||n,'Unrelated Firm '||n,'Atlanta','Active','https://example.test','2026-10-01' FROM seq");
 for(let i=0;i<15;i++){x.seed('target-'+i,'Target Lawyer '+i,'Target Firm '+i);x.sql.prepare('INSERT INTO directory_page_views VALUES(?,?,?,?,?)').run('firm-'+i,'firm','targetfirm'+i,'other','2026-11-02T12:00:00.000Z');}
 x.seed('numeric','Numeric Lawyer','00123');x.sql.prepare('INSERT INTO directory_page_views VALUES(?,?,?,?,?)').run('numeric-firm','firm','00123','other','2026-11-02T12:00:00.000Z');
 const {profileViewAnalytics}=await x.load('db/profile-view-analytics.ts');let query;
 const original=x.db.prepare.bind(x.db);x.db.prepare=q=>{if(q.includes('WITH ranked AS'))query=q;return original(q);};
 const result=await profileViewAnalytics(x.db,'2026-11-01','2026-11-03');assert.equal(result.firms.length,16);assert.equal(result.firms.find(f=>f.target==='00123').name,'00123');
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN '+query).all('2026-11-01','2026-11-03').map(row=>row.detail).join('\n');
 assert.match(plan,/SEARCH a USING INDEX attorneys_firm_key_idx/);assert.doesNotMatch(plan,/SCAN a\b/);
 const before=query.replace('=+r.target_key','=r.target_key'),start=performance.now(),expected=x.sql.prepare(before).all('2026-11-01','2026-11-03'),oldMs=performance.now()-start;
 const next=performance.now(),actual=x.sql.prepare(query).all('2026-11-01','2026-11-03'),newMs=performance.now()-next;assert.deepEqual(actual,expected);
 t.diagnostic(`Firm-view analytics / 10,016 attorneys: before ${oldMs.toFixed(1)} ms; after ${newMs.toFixed(1)} ms`);
 }finally{x.sql.close();}
});

test('firm charts avoid normalizing the entire nationwide roster on each ranking refresh',async t=>{
 const x=await runtime();try{
 seed(x);
 x.sql.exec("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<50000) INSERT INTO attorneys(bar_number,source_id,name,company,city,status,source_url,imported_at) SELECT 'bulk-'||n,'bulk-'||n,'Bulk Lawyer '||n,'Unrelated Firm '||n,'Atlanta','Active','https://example.test','2026-10-01' FROM seq");
 for(let i=0;i<20;i++)x.sql.prepare('INSERT INTO firm_search_events VALUES(?,?,?,?)').run('firm-'+i,'examplefirm','Example Firm','2026-11-02T12:00:00.000Z');
 const {firmChartSQL}=await x.load('app/api/attorneys/charts.ts'),{firmColumn}=await x.load('app/api/attorneys/firm.ts');
 const indexedPredicate=`(EXISTS(SELECT 1 FROM attorneys current WHERE ${firmColumn('current.company')}=+firm_search_events.firm_key) OR EXISTS(SELECT 1 FROM firm_settings fs WHERE fs.key=firm_search_events.firm_key AND fs.organization_type='Law Firm'))`;
 const old=firmChartSQL.replace('WITH activity AS (',`WITH known_firms AS MATERIALIZED (SELECT ${firmColumn()} AS firm_key FROM attorneys WHERE trim(company)<>'' UNION SELECT key AS firm_key FROM firm_settings WHERE organization_type='Law Firm'), activity AS (`).replace(indexedPredicate,'firm_key IN (SELECT firm_key FROM known_firms)');
 assert.notEqual(old,firmChartSQL);const bounds=['2026-11-01','2026-11-03','2026-11-01','2026-11-03'];
 const start=performance.now(),expected=x.sql.prepare(old).all(...bounds),oldMs=performance.now()-start;
 const next=performance.now(),actual=x.sql.prepare(firmChartSQL).all(...bounds),newMs=performance.now()-next;
 assert.deepEqual(actual,expected);assert.equal(actual[0].searches,20);
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN '+firmChartSQL).all(...bounds).map(row=>row.detail).join('\n');
 assert.match(plan,/SEARCH current USING (?:COVERING )?INDEX attorneys_firm_key_idx/);assert.doesNotMatch(plan,/SCAN attorneys\b|SCAN current\b|MATERIALIZE known_firms/);
 t.diagnostic(`Firm rankings / 50,001 attorneys: before ${oldMs.toFixed(1)} ms; after ${newMs.toFixed(1)} ms`);
 }finally{x.sql.close();}
});

test('practice search stays read-only, preserves owner categories, and uses indexed candidate lookups',async t=>{
 const x=await runtime();try{
 const practices=await x.load('app/practice-areas.ts');
 const sourceBars=Object.entries(practices.practiceSources).filter(([,s])=>s.areas.includes('family-law')).slice(0,2).map(([bar])=>bar);
 assert.equal(sourceBars.length,2);
 x.seed(sourceBars[0],'Source Family Lawyer');x.seed(sourceBars[1],'Owner Removed Family');x.seed('CUSTOM','Assigned Family Lawyer');x.seed('INACTIVE','Inactive Family Lawyer','Example','Inactive');
 x.sql.exec("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,practice_areas) VALUES('CUSTOM','','','now','Family law'),('INACTIVE','','','now','Family law')");
 x.sql.prepare("UPDATE attorneys SET owner_edited=1 WHERE bar_number=?").run(sourceBars[1]);
 x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,practice_areas) VALUES(?,'','','now','Tax')").run(sourceBars[1]);
 x.sql.exec("WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM nums WHERE n<100000) INSERT INTO attorneys(bar_number,source_id,name,company,city,state,status,source_url,imported_at) SELECT 'bulk-'||n,'bulk-'||n,'Unrelated '||n,'Other','Atlanta','GA','Active','https://example.test','now' FROM nums");
 x.sql.exec("UPDATE attorneys SET public_id=lower(hex(randomblob(16)))");
 const queries=[],original=x.db.prepare.bind(x.db);
 x.db.prepare=q=>{assert.doesNotMatch(q,/^(INSERT|UPDATE|DELETE)/i,'public search must not execute historical migrations');const statement=original(q),bind=statement.bind;statement.bind=(...args)=>{queries.push({q,args});return bind.apply(statement,args)};return statement;};
 const api=await x.load('app/api/attorneys/route.ts');
 const response=await api.GET(new Request('https://lawvetter.test/api/attorneys?practice=family-law&kind=attorneys'));
 assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.attorneys.map(a=>a.name).sort(),['Assigned Family Lawyer','Source Family Lawyer']);assert.equal(body.total,2);
 const query=queries.find(({q})=>q.startsWith('SELECT count(*) AS total FROM attorneys'));
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN '+query.q).all(...query.args).map(r=>r.detail).join('\n');
 assert.match(plan,/SEARCH attorneys USING INDEX sqlite_autoindex_attorneys_1 \(bar_number=\?\)/);
 assert.doesNotMatch(plan,/SCAN attorneys/);t.diagnostic(plan);
 const oldWhere="lower(trim(status)) IN ('active','active member in good standing','member in good standing') AND ((bar_number IN (SELECT value FROM json_each(?)) AND NOT (owner_edited=1 AND EXISTS(SELECT 1 FROM attorney_profiles ap WHERE ap.bar_number=attorneys.bar_number))) OR bar_number IN (SELECT value FROM json_each(?)))";
 const oldArgs=[JSON.stringify(Object.entries(practices.practiceSources).filter(([,v])=>v.areas.includes('family-law')).map(([bar])=>bar)),query.args[1]];
 const oldPlan=x.sql.prepare('EXPLAIN QUERY PLAN SELECT count(*) FROM attorneys WHERE '+oldWhere).all(...oldArgs).map(r=>r.detail).join(' | ');
 const before=performance.now();for(let n=0;n<10;n++)x.sql.prepare('SELECT count(*) FROM attorneys WHERE '+oldWhere).get(...oldArgs);const oldMs=performance.now()-before;
 const after=performance.now();for(let n=0;n<10;n++)x.sql.prepare(query.q).get(...query.args);const newMs=performance.now()-after;
 t.diagnostic(`100,004 attorneys, ten practice counts: before ${oldMs.toFixed(1)} ms; after ${newMs.toFixed(1)} ms. Previous plan: ${oldPlan}`);
 const cityResponse=await api.GET(new Request('https://lawvetter.test/api/attorneys?practice=family-law&kind=attorneys&city=Atlanta%2C+GA&exactCity=1'));
 assert.equal(cityResponse.status,200);assert.equal((await cityResponse.json()).total,2);
 const cityQuery=queries.findLast(({q})=>q.startsWith('SELECT count(*) AS total FROM attorneys'));
 const nextCityPlan=x.sql.prepare('EXPLAIN QUERY PLAN '+cityQuery.q).all(...cityQuery.args).map(r=>r.detail).join(' | ');
 assert.match(nextCityPlan,/SEARCH attorneys USING INDEX sqlite_autoindex_attorneys_1/);assert.doesNotMatch(nextCityPlan,/attorneys_state_source_idx/);
 const cityBefore=performance.now();for(let n=0;n<10;n++)x.sql.prepare('SELECT count(*) FROM attorneys WHERE '+oldWhere+" AND state=? AND lower(trim(city))=?").get(...oldArgs,'GA','atlanta');const cityOldMs=performance.now()-cityBefore;
 const cityAfter=performance.now();for(let n=0;n<10;n++)x.sql.prepare(cityQuery.q).get(...cityQuery.args);const cityNewMs=performance.now()-cityAfter;
 t.diagnostic(`100,004 attorneys, ten city/practice counts: before ${cityOldMs.toFixed(1)} ms; after ${cityNewMs.toFixed(1)} ms. New plan: ${nextCityPlan}`);
 const resultQuery=queries.findLast(({q})=>q.includes(' AS ownership_verified')&&q.includes('LIMIT 24'));
 assert.ok(resultQuery,'capture the real paginated result query');
 const resultPlan=x.sql.prepare('EXPLAIN QUERY PLAN '+resultQuery.q).all(...resultQuery.args).map(r=>r.detail).join(' | ');
 assert.match(resultPlan,/SEARCH attorneys USING INDEX sqlite_autoindex_attorneys_1/);assert.doesNotMatch(resultPlan,/attorneys_state_source_idx/);
 assert.ok(!queries.some(({q})=>q.includes('max(imported_at)')),'search must not scan the whole directory for unused global totals');
 }finally{x.sql.close();}
});
