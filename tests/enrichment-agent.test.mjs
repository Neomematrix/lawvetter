import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import jpeg from 'jpeg-js';
import {extractFlorida,research,officialUrl,robotsAllowed,boundedText} from '../lib/enrichment/sources.mjs';
import {startScan,advanceScan,decide,dashboard,stageProposal} from '../lib/enrichment/engine.mjs';
import {nextScan,nightlyKey} from '../lib/enrichment/time.mjs';
import {imageQuality,transformOptions,stageImage,inspectImages} from '../lib/enrichment/images.mjs';
import {researchDb} from '../lib/enrichment/research-db.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/enrichment/profiles.json',import.meta.url)));
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
 const db={prepare(query){return {bind(...args){this.args=args;return this;},async first(){return sql.prepare(query).get(...(this.args||[]))||null;},async all(){return {results:sql.prepare(query).all(...(this.args||[]))};},async run(){const r=sql.prepare(query).run(...(this.args||[]));return {meta:{changes:r.changes}};}};},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 for(const a of fixtures){const keys=Object.keys(a);sql.prepare(`INSERT INTO attorneys(${keys.join(',')}) VALUES(${keys.map(()=>'?')})`).run(...Object.values(a));}
 return {db,sql};
}
function html(a){return `<html><h1>${a.name}</h1><p>Bar Number: ${a.license_number}</p><dl><dt>Admission Date:</dt><dd>10/20/2014</dd><dt>Law School:</dt><dd>Fixture Law School</dd><dt>County:</dt><dd>Fixture County</dd><dt>Practice Areas:</dt><dd>Family Law</dd></dl></html>`;}
async function source(a){const values=extractFlorida(html(a),a).values;return {values,url:a.source_url,retrievedAt:new Date().toISOString(),hash:'synthetic-only'};}
async function runAll(db,sql){for(let i=0;i<27;i++){sql.exec('UPDATE enrichment_scans SET lease_until=0');await advanceScan(db,{research:source});}}
test('25 representative incomplete profiles: bounded/resumable scan generates evidence without live changes',async()=>{
 const {db,sql}=database(),before=sql.prepare('SELECT * FROM attorneys').all();
 const id=await startScan(db,'owner');assert.equal(await startScan(db,'owner'),id);
 await advanceScan(db,{research:source});assert.equal(sql.prepare('SELECT count(*) n FROM enrichment_jobs').get().n,25);
 assert.deepEqual(sql.prepare('SELECT * FROM attorneys').all(),before);
 // Simulate process restart and concurrent dispatch. A live lease prevents another request.
 const busy=await advanceScan(db,{research:()=>{throw Error('Should not fetch under lease');}});assert.equal(busy.busy,true);
 await runAll(db,sql);
 assert.equal(sql.prepare('SELECT scanned FROM enrichment_scans').get().scanned,25);
 assert.equal(sql.prepare("SELECT count(*) n FROM enrichment_jobs WHERE status='done'").get().n,25);
 assert.deepEqual(sql.prepare('SELECT * FROM attorneys').all(),before);
 assert.equal(sql.prepare("SELECT count(*) n FROM enrichment_proposals WHERE field='admit_date'").get().n,25);
 const evidence=sql.prepare('SELECT * FROM enrichment_evidence LIMIT 1').get();assert.ok(evidence.source_url.startsWith('https://www.floridabar.org/'));assert.ok(evidence.retrieved_at);assert.equal(evidence.verified,1);
 await startScan(db,'owner');await runAll(db,sql);assert.equal(sql.prepare('SELECT count(*) n FROM enrichment_jobs').get().n,25,'unchanged receipts prevent another research pass');
});
test('strict Florida identity and field extraction never guesses missing or unsupported facts',()=>{
 const a=fixtures[0],result=extractFlorida(html(a),a);assert.equal(result.values.admit_date.value,'2014-10-20');assert.equal(result.values.law_school.value,'Fixture Law School');assert.equal(result.values.address,undefined);
 for(const change of [{state:'GA'},{name:'Another Person'},{license_number:'12345'},{source_url:a.source_url.replace('37329','x')+'&num=555'},{source_url:'https://www.floridabar.org.evil.test/directories/find-mbr/profile/?num='+a.license_number}])assert.throws(()=>extractFlorida(html(a),{...a,...change}));
 assert.throws(()=>extractFlorida('<h1>'+a.name+'</h1><h1>Duplicate</h1> Bar Number: '+a.license_number,a));
 assert.throws(()=>extractFlorida('captcha',a));assert.throws(()=>officialUrl({...a,source_url:'http://www.floridabar.org/'}));
 assert.equal(extractFlorida(html(a).replace('10/20/2014','02/31/2014'),a).values.admit_date,undefined);
 assert.throws(()=>extractFlorida(html(a).replace('</dl>','<dt>Law School:</dt><dd>Conflicting School</dd></dl>'),a));
});
test('source access honors robots, blocks redirects/challenges and bounds downloads',async()=>{
 const a=fixtures[0],fetcher=async url=>new Response(String(url).endsWith('/robots.txt')?'User-agent: *\nAllow: /':html(a),{headers:{'Content-Type':'text/html'}});
 const r=await research(a,fetcher);assert.equal(r.hash.length,64);assert.equal(r.license,a.license_number);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /directories/','/directories/find-mbr/profile/'),false);
 await assert.rejects(research(a,async()=>new Response('blocked',{status:403})),/unavailable/);
 await assert.rejects(research(a,async()=>new Response('',{status:302})),/unavailable/);
 await assert.rejects(boundedText(new Response('oversized'),3),/size limit/);
});
test('owner decisions are atomic, safe bulk requires selection, rollback is compare-and-set',async()=>{
 const {db,sql}=database();await startScan(db,'owner');await runAll(db,sql);
 const rows=sql.prepare("SELECT * FROM enrichment_proposals WHERE field='law_school' ORDER BY entity_id LIMIT 2").all();
 await assert.rejects(decide(db,[rows[0].id],'approved',''),/Invalid owner/);
 assert.equal(sql.prepare('SELECT law_school FROM attorneys WHERE bar_number=?').get(rows[0].entity_id).law_school,'');
 sql.prepare("UPDATE attorneys SET law_school='New owner edit' WHERE bar_number=?").run(rows[1].entity_id);
 await assert.rejects(decide(db,rows.map(r=>r.id),'approved','owner'),/changed/);
 assert.equal(sql.prepare('SELECT law_school FROM attorneys WHERE bar_number=?').get(rows[0].entity_id).law_school,'','bulk rolls back every selected change on one stale value');
 await decide(db,[rows[0].id],'approved','owner');assert.equal(sql.prepare('SELECT law_school FROM attorneys WHERE bar_number=?').get(rows[0].entity_id).law_school,rows[0].proposed);
 await decide(db,[rows[0].id],'rolled_back','owner');assert.equal(sql.prepare('SELECT law_school FROM attorneys WHERE bar_number=?').get(rows[0].entity_id).law_school,'');
 assert.equal(sql.prepare('SELECT count(*) n FROM enrichment_audit WHERE proposal_id=?').get(rows[0].id).n,2);
 assert.throws(()=>sql.exec("UPDATE enrichment_evidence SET verified=0"),/immutable/);
 assert.throws(()=>sql.exec("UPDATE enrichment_proposals SET proposed='invented'"),/immutable/);
 assert.throws(()=>sql.exec('DELETE FROM enrichment_audit'),/immutable/);
});
test('claims, changed identity, stale evidence and unverified image tasks cannot publish',async()=>{
 const {db,sql}=database();await startScan(db,'owner');await runAll(db,sql);
 const rows=sql.prepare("SELECT * FROM enrichment_proposals WHERE field='law_school' ORDER BY entity_id LIMIT 3").all();
 sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,'client-owner','now','now')").run(rows[0].entity_id);
 await assert.rejects(decide(db,[rows[0].id],'approved','owner'),/claimed/);
 sql.prepare("UPDATE attorneys SET name='New identity' WHERE bar_number=?").run(rows[1].entity_id);
 await assert.rejects(decide(db,[rows[1].id],'approved','owner'),/changed/);
 const p=rows[2];await stageProposal(db,{entity:'attorney',entityId:p.entity_id,name:p.name,state:p.state,kind:'text',field:'county',original:'',proposed:'Fixture County',baseIdentity:p.base_identity,explanation:'Stale evidence fixture',evidence:{url:'https://www.floridabar.org/',retrievedAt:'2020-01-01T00:00:00Z',contentHash:'stale',excerpt:'fixture',verified:true}});
 const stale=sql.prepare("SELECT id FROM enrichment_proposals WHERE explanation='Stale evidence fixture'").get();await assert.rejects(decide(db,[stale.id],'approved','owner'),/stale/);
 // Simulated client reviews/accounts never become a permitted target.
 await stageProposal(db,{entity:'client_reviews',entityId:p.entity_id,name:p.name,state:p.state,kind:'text',field:'review_body',original:'',proposed:'bad',baseIdentity:p.base_identity,explanation:'attack fixture',evidence:{url:'https://www.floridabar.org/',retrievedAt:new Date().toISOString(),contentHash:'attack',excerpt:'fixture',verified:true}});
 const attack=sql.prepare("SELECT id FROM enrichment_proposals WHERE entity='client_reviews'").get();await assert.rejects(decide(db,[attack.id],'approved','owner'),/changed/);
});
test('failed research retries with backoff and bounded attempts; errors do not publish',async()=>{
 const {db,sql}=database();await startScan(db,'owner');const fail=async()=>{throw Error('Source unavailable 403');};
 for(let i=0;i<3;i++){sql.exec('UPDATE enrichment_scans SET lease_until=0; UPDATE enrichment_jobs SET next_attempt=0');await advanceScan(db,{research:fail});}
 assert.equal(sql.prepare("SELECT count(*) n FROM enrichment_jobs WHERE status='failed' AND attempts=3").get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM enrichment_proposals').get().n,0);
});
test('midnight Eastern targets EST and EDT including both DST transition dates',()=>{
 for(const [start,expected] of [['2026-01-03T03:00:00Z','2026-01-03T05:00:00.000Z'],['2026-07-03T03:00:00Z','2026-07-03T04:00:00.000Z'],['2026-03-08T05:01:00Z','2026-03-09T04:00:00.000Z'],['2026-11-01T04:01:00Z','2026-11-02T05:00:00.000Z']])assert.equal(nextScan(new Date(start)),expected);
 assert.equal(nightlyKey(new Date('2026-07-03T04:40:00Z')),'2026-07-03');assert.equal(nightlyKey(new Date('2026-07-03T05:00:00Z')),null);
});
test('research capability denies live-record, account, review and decision writes',()=>{
 const {db}=database(),limited=researchDb(db);
 for(const sql of ["UPDATE attorneys SET law_school='x'","UPDATE attorney_profiles SET bio='x'","SELECT * FROM client_profiles","SELECT * FROM client_verifications","UPDATE enrichment_proposals SET status='approved'","DELETE FROM enrichment_scans","SELECT * FROM attorneys; DROP TABLE attorneys"])assert.throws(()=>limited.prepare(sql),/Research/);
});
test('rollback refuses a newer edit and valid bulk updates are audited individually',async()=>{
 const {db,sql}=database();await startScan(db,'owner');await runAll(db,sql);
 const rows=sql.prepare("SELECT * FROM enrichment_proposals WHERE field='law_school' ORDER BY entity_id LIMIT 2").all();
 await decide(db,rows.map(p=>p.id),'approved','owner');
 assert.equal(sql.prepare('SELECT count(*) n FROM enrichment_audit').get().n,2);
 sql.prepare('UPDATE attorneys SET law_school=? WHERE bar_number=?').run('Newer school edit',rows[0].entity_id);
 await assert.rejects(decide(db,[rows[0].id],'rolled_back','owner'),/changed/);
 assert.equal(sql.prepare('SELECT law_school FROM attorneys WHERE bar_number=?').get(rows[0].entity_id).law_school,'Newer school edit');
});
test('image pipeline uses the same authorized original for both contain variants and preserves rollback',async()=>{
 const {db,sql}=database(),a=fixtures[1],pixels=new Uint8Array(40*50*4).fill(125),bytes=jpeg.encode({data:pixels,width:40,height:50},90).data;
 const q=imageQuality(bytes);assert.ok(q.reasons.some(r=>r.includes('resolution')));assert.ok(q.reasons.some(r=>r.includes('blur')));
 assert.equal(transformOptions('banner',1600).height,533);assert.equal(transformOptions('banner',1600).fit,'contain');
 const files=new Map(),seen=[];const bucket={async put(k,v){files.set(k,v);}},images={input(stream){seen.push(stream);return {transform(options){assert.equal(options.fit,'contain');assert.ok(options.sharpen<1);return {async output(){return {response:()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/webp'}})};}};}};}};
 const baseIdentity=JSON.stringify([a.name,a.state,a.license_number,a.source_url]);
 const item={entity:'attorney',entityId:a.bar_number,name:a.name,state:a.state,kind:'photo',field:'photo_key',original:'',baseIdentity,sourceUrl:'https://example.test/fixture',identityNote:'Synthetic identity confirmed for the test fixture',rights:'Synthetic fixture created solely for this automated test',identityConfirmed:true};
 await assert.rejects(stageImage(db,bucket,images,{...item,identityConfirmed:false},bytes),/Confirm identity/);
 await stageImage(db,bucket,images,item,bytes);assert.equal(seen.length,2);assert.equal(files.size,3);assert.ok([...files.keys()].some(k=>k.endsWith('original')));
 const row=sql.prepare("SELECT * FROM enrichment_proposals WHERE kind='photo'").get();
 await decide(db,[row.id],'approved','owner');assert.equal(sql.prepare('SELECT photo_key FROM attorney_profiles WHERE bar_number=?').get(a.bar_number).photo_key,row.proposed);
 await decide(db,[row.id],'rolled_back','owner');assert.equal(sql.prepare('SELECT photo_key FROM attorney_profiles WHERE bar_number=?').get(a.bar_number).photo_key,'');assert.equal(files.size,3,'rollback keeps original and staged files');
 await inspectImages(db,{get:async()=>null},{entity:'attorney',entityId:a.bar_number,name:a.name,state:a.state,baseIdentity,attorney:{...a,photo_key:''},source:await source(a)});
 const issue=sql.prepare("SELECT * FROM enrichment_proposals WHERE kind='photo' AND proposed=''").get();await assert.rejects(decide(db,[issue.id],'approved','owner'),/decision|Unverified/);
 const d=await dashboard(db,{kind:'photo'});assert.ok(d.rows.every(p=>p.kind==='photo'));assert.ok(d.nextScan);
});
