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


async function fixture(){const sent=[],x=await runtime({fetch:async(url,options)=>{assert.equal(String(url),'https://api.resend.com/emails');sent.push(JSON.parse(options.body));return Response.json({id:'mail-'+sent.length});}});x.env.RESEND_API_KEY='fixture-not-real';x.sql.exec("INSERT INTO firm_settings(key,name,website,updated_at) VALUES('alpha','Alpha','https://recorded-alpha.example','now'),('beta','Beta','https://beta.example','now');");x.seed('100001','Alpha Lawyer','Alpha');x.seed('100002','Beta Lawyer','Beta');x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES('100001','individual-owner','approved','now','Original bio')").run();
 for(const [id,name]of [['manager','Manager Person'],['rival','Other Person'],['individual-owner','Individual Owner']])x.sql.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES(?,?,?,?)').run(id,name,id+'@example.test',new Date().toISOString());const auth=await x.load('db/client-auth.ts'),cookies={};for(const id of ['manager','rival','individual-owner'])cookies[id]='__Host-lawvetter-client='+await auth.newSession(id);
 const management=await x.load('app/api/firm-management/route.ts'),admin=await x.load('app/api/admin/firm-claims/route.ts'),verify=await x.load('app/api/firm-claims/verify/route.ts'),access=await x.load('db/firm-access.ts');
 function request(body,cookie=cookies.manager,url='/api/firm-management',origin='https://lawvetter.test'){return new Request('https://lawvetter.test'+url,{method:body?'POST':'GET',headers:{origin,cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
 async function claim(who='manager'){const response=await management.POST(request({action:'request',firm:'Alpha',firmEmail:who+'@alpha.example',authority:'I am a managing partner. My official firm biography verifies my authority.',attestation:true},cookies[who]));assert.equal(response.status,201,JSON.stringify(await response.clone().json()));const row=x.sql.prepare('SELECT * FROM firm_claims WHERE user_id=?').get(who);return row;}
 function token(){return new URL(sent.filter(x=>x.text.includes('/firm-access/verify?token=')).at(-1).text.match(/https:\/\/\S+/)[0]).searchParams.get('token');}
 async function approve(){const row=await claim();assert.equal((await verify.POST(request({token:token()},'','/api/firm-claims/verify'))).status,200);const response=await admin.POST(request({action:'approve',id:row.id,verified:true},adminTestCookie,'/api/admin/firm-claims'));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));return row;}
 return {...x,sent,cookies,management,admin,verify,access,request,claim,token,approve};}

test('unmatched firm domains require admin approval; old tokens work and cannot be replayed',async()=>{const x=await fixture();try{
 const row=await x.claim();assert.equal(x.sent.length,2);assert.equal(x.sql.prepare('SELECT email_token_hash FROM firm_claims').get().email_token_hash.length,64);assert.notEqual(x.sql.prepare('SELECT email_token_hash FROM firm_claims').get().email_token_hash,x.token());assert.equal(await x.access.firmAccess('manager','alpha'),false);
 const decision=verified=>x.admin.POST(x.request({action:'approve',id:row.id,verified},adminTestCookie,'/api/admin/firm-claims'));
 assert.equal((await decision(true)).status,400);const token=x.token();assert.equal((await x.verify.POST(x.request({token},'','/api/firm-claims/verify'))).status,200);assert.equal((await x.verify.POST(x.request({token},'','/api/firm-claims/verify'))).status,400);assert.equal(await x.access.firmAccess('manager','alpha'),false);assert.equal((await decision(false)).status,400);assert.equal((await decision(true)).status,200);assert.equal(await x.access.firmAccess('manager','alpha'),true);assert.equal(await x.access.firmAccess('manager','beta'),false);
 const rival=await x.claim('rival');const expired=x.token();x.sql.prepare('UPDATE firm_claims SET email_token_expires=0 WHERE id=?').run(rival.id);assert.equal((await x.verify.POST(x.request({token:expired},'','/api/firm-claims/verify'))).status,200);assert.equal(await x.access.firmAccess('rival','alpha'),false);
 }finally{x.sql.close();}});

test('firm managers edit only their firm and affiliated attorneys while preserving individual ownership and official identity',async()=>{const x=await fixture();try{await x.approve();
 const fields={website:'https://alpha.example/new',linkedin_url:'https://www.linkedin.com/company/alpha',address:'100 Main St',city:'Atlanta',state:'GA',zip:'30303',phone:'404-555-0100',email:'contact@alpha.example',biography:'New firm biography',additional_locations:JSON.stringify([{address:'200 Second St',city:'Marietta',state:'GA',zip:'30060'}])};
 let response=await x.management.POST(x.request({action:'save-firm',firm:'Alpha',record:fields}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(x.sql.prepare("SELECT biography FROM firm_settings WHERE key='alpha'").get().biography,'New firm biography');
 response=await x.management.POST(x.request({action:'save-firm',firm:'Beta',record:fields}));assert.equal(response.status,403);
 const lawyer={languages:'spanish, English',address:'10 Lawyer St',city:'Atlanta',zip:'30303',phone:'404-555-0101',email:'lawyer@alpha.example',county:'Fulton',bio:'New lawyer biography',headline:'Trial attorney',practice_areas:'Family law',website:'https://alpha.example/lawyer',linkedin_url:'',owner_id:'manager',status:'Disbarred',name:'Forged name',state:'TX'};
 response=await x.management.POST(x.request({action:'save-attorney',firm:'Alpha',bar:'100001',record:lawyer}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const profile=x.sql.prepare("SELECT * FROM attorney_profiles WHERE bar_number='100001'").get();assert.equal(profile.languages,'Spanish, English');assert.equal(profile.bio,lawyer.bio);assert.equal(profile.owner_id,'individual-owner');assert.equal(profile.claimed_at,'approved');const record=x.sql.prepare("SELECT * FROM attorneys WHERE bar_number='100001'").get();assert.equal(record.name,'Alpha Lawyer');assert.equal(record.state,'GA');assert.equal(record.status,'Active Member in Good Standing');
 assert.equal((await x.management.POST(x.request({action:'save-attorney',firm:'Alpha',bar:'100002',record:lawyer}))).status,403);assert.equal((await x.management.POST(x.request({action:'save-firm',firm:'Alpha',record:fields},x.cookies.rival))).status,403);assert.equal((await x.management.POST(x.request({action:'save-firm',firm:'Alpha',record:fields},x.cookies.manager,'/api/firm-management','https://evil.test'))).status,403);
 const own=x.sql.prepare('SELECT id FROM firm_claims WHERE user_id=?').get('manager');assert.equal((await x.admin.POST(x.request({action:'revoke',id:own.id},adminTestCookie,'/api/admin/firm-claims'))).status,200);assert.equal(await x.access.firmAccess('manager','alpha'),false);assert.equal((await x.management.POST(x.request({action:'save-firm',firm:'Alpha',record:fields}))).status,403);
 }finally{x.sql.close();}});

test('private inbox and analytics require firm scope; Google visits and internal searches are recorded separately',async()=>{const x=await fixture();try{await x.approve();const messages=await x.load('app/api/firm-messages/route.ts'),views=await x.load('app/api/directory-views/route.ts'),insights=await x.load('app/api/account/insights/route.ts');
 let response=await messages.POST(x.request({action:'send',firm:'Alpha',name:'Potential Client',email:'client@example.com',message:'I need help with a legal question and would like a consultation.',consent:true},'','/api/firm-messages'));assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
 response=await messages.GET(x.request(null,x.cookies.rival,'/api/firm-messages?firm=Alpha'));assert.equal(response.status,403);response=await messages.GET(x.request(null,x.cookies.manager,'/api/firm-messages?firm=Alpha'));assert.equal(response.status,200);const inbox=await response.json();assert.equal(inbox.messages.length,1);assert.equal(inbox.stats.unread,1);
 assert.equal((await messages.POST(x.request({action:'status',firm:'Beta',id:inbox.messages[0].id,status:'closed'},x.cookies.manager,'/api/firm-messages'))).status,403);assert.equal((await messages.POST(x.request({action:'status',firm:'Alpha',id:inbox.messages[0].id,status:'read'},x.cookies.manager,'/api/firm-messages'))).status,200);
 const eventId=nodeCrypto.randomUUID();assert.equal((await views.POST(x.request({kind:'firm',target:'Alpha',eventId,referrer:'https://www.google.com/search?q=lawyer'},'','/api/directory-views'))).status,200);assert.equal((await views.POST(x.request({kind:'firm',target:'Alpha',eventId,referrer:'https://www.google.com/search'},'','/api/directory-views'))).status,200);assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM directory_page_views').get().n,1);assert.equal(x.sql.prepare('SELECT source FROM directory_page_views').get().source,'google');
 x.sql.prepare('INSERT INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').run(nodeCrypto.randomUUID(),'alpha','Alpha',new Date().toISOString());
 response=await insights.GET(x.request(null,x.cookies.manager,'/api/account/insights?kind=firm&target=Alpha'));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const data=await response.json();assert.equal(data.series.length,30);assert.equal(data.totals.google,1);assert.equal(data.totals.views,1);assert.equal(data.totals.searches,1);assert.equal((await insights.GET(x.request(null,x.cookies.rival,'/api/account/insights?kind=firm&target=Alpha'))).status,403);assert.equal((await insights.GET(x.request(null,x.cookies.manager,'/api/account/insights?kind=attorney&target=100002'))).status,403);assert.equal((await insights.GET(x.request(null,x.cookies['individual-owner'],'/api/account/insights?kind=attorney&target=100001'))).status,200);
 const row=x.sql.prepare('SELECT id FROM firm_claims WHERE user_id=?').get('manager');await x.admin.POST(x.request({action:'revoke',id:row.id},adminTestCookie,'/api/admin/firm-claims'));assert.equal((await messages.GET(x.request(null,x.cookies.manager,'/api/firm-messages?firm=Alpha'))).status,403);assert.equal((await insights.GET(x.request(null,x.cookies.manager,'/api/account/insights?kind=firm&target=Alpha'))).status,403);
 }finally{x.sql.close();}});

test('analytics ranges include full recorded history, keep totals aligned, and retain access checks',async()=>{const x=await fixture();try{
 await x.approve();const insights=await x.load('app/api/account/insights/route.ts'),now=Date.now(),stamp=days=>new Date(now-days*86400000).toISOString();
 for(const days of [150,15,1])x.sql.prepare('INSERT INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').run(nodeCrypto.randomUUID(),'alpha','Alpha',stamp(days));
 x.sql.prepare('INSERT INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').run(nodeCrypto.randomUUID(),'beta','Beta',stamp(1));
 for(const [days,source] of [[150,'google'],[15,'google'],[1,'direct']])x.sql.prepare('INSERT INTO directory_page_views(event_id,target_kind,target_key,source,created_at) VALUES(?,?,?,?,?)').run(nodeCrypto.randomUUID(),'firm','alpha',source,stamp(days));
 const before=x.sql.prepare('SELECT COUNT(*) n FROM directory_page_views').get().n;
 for(const [range,searches,google,views] of [[7,1,0,1],[30,3,1,2],['all',5,2,3]]){
  const response=await insights.GET(x.request(null,x.cookies.manager,'/api/account/insights?kind=firm&target=Alpha&days='+range));assert.equal(response.status,200);const data=await response.json();assert.equal(data.days,range);assert.deepEqual(data.totals,{searches,google,views});
  for(const key of ['searches','google','views'])assert.equal(data.series.reduce((n,row)=>n+row[key],0),data.totals[key]);
  assert.equal(data.series.length,range==='all'?151:range);
 }
 assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM directory_page_views').get().n,before);
 assert.equal((await insights.GET(x.request(null,x.cookies.rival,'/api/account/insights?kind=firm&target=Alpha&days=all'))).status,403);
 }finally{x.sql.close();}});

test('another verified claimant cannot replace an approved firm manager; failed email never grants access',async()=>{const x=await fixture();try{await x.approve();const rival=await x.claim('rival');await x.verify.POST(x.request({token:x.token()},'','/api/firm-claims/verify'));const response=await x.admin.POST(x.request({action:'approve',id:rival.id,verified:true},adminTestCookie,'/api/admin/firm-claims'));assert.equal(response.status,409);assert.equal(await x.access.firmAccess('manager','alpha'),true);assert.equal(await x.access.firmAccess('rival','alpha'),false);
 const retry=await x.management.POST(x.request({action:'resend',id:rival.id},x.cookies.manager));assert.equal(retry.status,404);assert.equal((await x.admin.POST(x.request({action:'approve',id:rival.id,verified:true},x.cookies.rival,'/api/admin/firm-claims'))).status,401);
 }finally{x.sql.close();}});

test('firm photo uploads preserve attorney ownership and revoked access cannot finish an upload',async()=>{const x=await fixture();try{await x.approve();const api=await x.load('app/api/firm-management/photo/route.ts'),png=Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
 const upload=(bar='100001')=>{const form=new FormData();form.set('firm','Alpha');form.set('bar',bar);form.set('photo',new File([png],'photo.png',{type:'image/png'}));return api.POST(new Request('https://lawvetter.test/api/firm-management/photo',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:x.cookies.manager},body:form}));};
 let response=await upload();assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(x.sql.prepare("SELECT owner_id FROM attorney_profiles WHERE bar_number='100001'").get().owner_id,'individual-owner');assert.equal(x.files.size,1);assert.equal((await upload('100002')).status,403);
 const put=x.env.PROFILE_PHOTOS.put;x.env.PROFILE_PHOTOS.put=async(...args)=>{await put(...args);x.sql.exec("UPDATE firm_claims SET status='revoked' WHERE user_id='manager'");};response=await upload();assert.equal(response.status,409);assert.equal(x.files.size,1);
 }finally{x.sql.close();}});

test('admin firm rename preserves management and inbox; removing an account releases its firm access',async()=>{const x=await fixture();try{await x.approve();x.sql.prepare("UPDATE firm_settings SET biography='Firm biography' WHERE key='alpha'").run();x.sql.prepare("INSERT INTO firm_messages VALUES('message','alpha','Client','client@example.com','','','A private message','new','now','now')").run();const records=await x.load('app/api/admin/records/route.ts');
 const response=await records.POST(x.request({kind:'firms',record:{key:'alpha',name:'Alpha Renamed',website:'https://alpha.example'}},adminTestCookie,'/api/admin/records'));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(await x.access.firmAccess('manager','alpharenamed'),true);assert.equal(await x.access.firmAccess('manager','alpha'),false);assert.equal(x.sql.prepare("SELECT biography FROM firm_settings WHERE key='alpharenamed'").get().biography,'Firm biography');assert.equal(x.sql.prepare('SELECT firm_key FROM firm_messages').get().firm_key,'alpharenamed');
 const deleted=await records.DELETE(x.request({kind:'clients',id:'manager',confirm:true},adminTestCookie,'/api/admin/records'));assert.equal(deleted.status,200,JSON.stringify(await deleted.clone().json()));assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM firm_owners').get().n,0);assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM attorneys WHERE company='Alpha Renamed'").get().n,1);
 }finally{x.sql.close();}});

test('unavailable email delivery leaves the request pending and Google source matching excludes lookalike domains',async()=>{const x=await fixture();try{delete x.env.RESEND_API_KEY;const row=await x.claim();assert.equal(x.sent.length,0);assert.equal(row.status,'pending');assert.equal(row.firm_email_verified_at,null);assert.equal(row.email_token_hash,'');assert.equal(await x.access.firmAccess('manager','alpha'),false);const source=await x.load('app/traffic-source.ts');assert.equal(source.googleTraffic('https://www.google.com/search?q=lawyer'),true);assert.equal(source.googleTraffic('https://www.google.co.uk/search'),true);assert.equal(source.googleTraffic('https://www.google.com.attacker.test/'),false);assert.equal(source.googleTraffic('https://notgoogle.com/'),false);assert.equal(source.googleTraffic(''),false);}finally{x.sql.close();}});

test('approval preserves a firm page even when its last attorney is removed from the roster',async()=>{const x=await fixture();try{x.sql.exec("DELETE FROM firm_settings WHERE key='alpha'");await x.approve();assert.equal(x.sql.prepare("SELECT name FROM firm_settings WHERE key='alpha'").get().name,'Alpha');const response=await x.management.POST(x.request({action:'detach',firm:'Alpha',bar:'100001',confirm:true}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal((await x.access.firmRecord('alpha')).name,'Alpha');assert.equal(await x.access.firmAccess('manager','alpha'),true);assert.equal(x.sql.prepare("SELECT owner_id FROM attorney_profiles WHERE bar_number='100001'").get().owner_id,'individual-owner');}finally{x.sql.close();}});


test('firm charts mark only approved email-confirmed claims and remove the badge after revocation',async()=>{const x=await fixture();try{
 const now=new Date().toISOString();x.sql.prepare('INSERT INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').run('alpha-search','alpha','Alpha',now);x.sql.prepare('INSERT INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').run('beta-search','beta','Beta',now);
 const charts=await x.load('app/api/attorneys/charts.ts'),read=()=>x.sql.prepare(charts.firmChartSQL).all('',now,'',now);
 assert.deepEqual(read().map(f=>f.ownership_verified),[0,0]);const claim=await x.claim();assert.equal(read()[0].ownership_verified,0);
 assert.equal((await x.verify.POST(x.request({token:x.token()},'','/api/firm-claims/verify'))).status,200);assert.equal(read()[0].ownership_verified,0);
 assert.equal((await x.admin.POST(x.request({action:'approve',id:claim.id,verified:true},adminTestCookie,'/api/admin/firm-claims'))).status,200);
 const approved=read();assert.deepEqual(approved.map(f=>[f.firm_key,f.ownership_verified,f.searches,f.rank]),[['alpha',1,1,1],['beta',0,1,2]]);
 const data=await charts.discoveryData(x.db,true);for(const rows of [data.weeklyFirms,data.monthlyFirms]){assert.equal(rows.find(f=>f.firm_key==='alpha').ownership_verified,1);assert.equal(rows.find(f=>f.firm_key==='beta').ownership_verified,0);}
 assert.equal((await x.admin.POST(x.request({action:'revoke',id:claim.id},adminTestCookie,'/api/admin/firm-claims'))).status,200);assert.equal(read()[0].ownership_verified,0);
 }finally{x.sql.close();}});


test('administrator can verify an existing firm account directly without sending another email',async()=>{const x=await fixture();try{
 const grant=(extra={},cookie=adminTestCookie)=>x.admin.POST(x.request({action:'grant',firm:'Alpha',email:'manager@example.test',verified:true,...extra},cookie,'/api/admin/firm-claims'));
 assert.equal((await grant({},x.cookies.manager)).status,401);assert.equal((await grant({verified:false})).status,400);assert.equal((await grant({email:'missing@example.test'})).status,404);assert.equal(await x.access.firmAccess('manager','alpha'),false);
 const response=await grant();assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(await x.access.firmAccess('manager','alpha'),true);assert.equal(await x.access.firmAccess('manager','beta'),false);assert.equal(x.sent.length,0);
 const claim=x.sql.prepare("SELECT * FROM firm_claims WHERE user_id='manager'").get();assert.equal(claim.status,'approved');assert.ok(claim.firm_email_verified_at);assert.match(claim.authority,/administrator/);assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='firm-access-granted'").get().n,1);
 assert.equal((await grant({email:'rival@example.test'})).status,409);assert.equal((await grant()).status,409);
 assert.equal((await x.admin.POST(x.request({action:'revoke',id:claim.id},adminTestCookie,'/api/admin/firm-claims'))).status,200);assert.equal(await x.access.firmAccess('manager','alpha'),false);
 }finally{x.sql.close();}});


test('firm practice areas persist across owner and administrator edits and appear with verified ownership publicly',async()=>{const x=await fixture();try{await x.approve();
 let response=await x.management.POST(x.request({action:'save-firm',firm:'Alpha',record:{practice_areas:'Personal injury, Business, Personal injury',website:'https://alpha.example'}}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 assert.equal(x.sql.prepare("SELECT practice_areas FROM firm_settings WHERE key='alpha'").get().practice_areas,'Personal injury, Business');
 let details=await(await x.management.GET(x.request(null,x.cookies.manager,'/api/firm-management?firm=Alpha'))).json();assert.equal(details.details.practice_areas,'Personal injury, Business');
 const publicRoute=await x.load('app/api/attorneys/route.ts');let page=await(await publicRoute.GET(new Request('https://lawvetter.test/api/attorneys?firm=Alpha'))).json();assert.equal(page.firm.practiceAreas,'Personal injury, Business');assert.equal(page.firm.ownershipVerified,true);
 response=await x.management.POST(x.request({action:'save-firm',firm:'Alpha',record:{website:'https://alpha.example/updated'}}));assert.equal(response.status,200);assert.equal(x.sql.prepare("SELECT practice_areas FROM firm_settings WHERE key='alpha'").get().practice_areas,'Personal injury, Business');
 const admin=await x.load('app/api/admin/records/route.ts');response=await admin.POST(x.request({kind:'firms',record:{key:'alpha',name:'Alpha',practiceAreas:'Civil Litigation, Business',website:'https://alpha.example'}},adminTestCookie,'/api/admin/records'));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const listed=await(await admin.GET(x.request(null,adminTestCookie,'/api/admin/records?kind=firms'))).json();assert.equal(listed.records.find(f=>f.key==='alpha').practiceAreas,'Civil Litigation, Business');
 page=await(await publicRoute.GET(new Request('https://lawvetter.test/api/attorneys?firm=Alpha'))).json();assert.equal(page.firm.practiceAreas,'Civil Litigation, Business');
 const invalid=await x.management.POST(x.request({action:'save-firm',firm:'Alpha',record:{practice_areas:'<script>bad</script>'}}));assert.equal(invalid.status,400);
 const claim=x.sql.prepare("SELECT id FROM firm_claims WHERE user_id='manager'").get();await x.admin.POST(x.request({action:'revoke',id:claim.id},adminTestCookie,'/api/admin/firm-claims'));page=await(await publicRoute.GET(new Request('https://lawvetter.test/api/attorneys?firm=Alpha'))).json();assert.equal(page.firm.ownershipVerified,false);
 }finally{x.sql.close();}});

test('new firm claims notify the configured admin once, and notification retries preserve ownership',async()=>{const x=await fixture();try{const claim=await x.claim();const notices=()=>x.sent.filter(mail=>mail.to.includes('admin@example.test'));assert.equal(notices().length,1);assert.match(notices()[0].text,/Manager Person/);assert.match(notices()[0].text,/\/admin\/firm-claims/);const notify=await x.load('db/firm-claim-notification.ts');assert.equal(await notify.notifyFirmClaim(claim.id),'accepted');assert.equal(notices().length,1);assert.equal(await x.access.firmAccess('manager','alpha'),false);const response=await x.admin.POST(x.request({action:'notify',id:claim.id},'','/api/admin/firm-claims'));assert.equal(response.status,401);}finally{x.sql.close();}});

test('replacement firm confirmation invalidates old link without granting management access',async()=>{const x=await fixture();try{const claim=await x.claim(),old=x.token();x.sql.prepare('UPDATE firm_claims SET email_sent_at=0 WHERE id=?').run(claim.id);const resend=await x.management.POST(x.request({action:'resend',id:claim.id}));assert.equal(resend.status,200);const latest=x.token();assert.notEqual(latest,old);assert.equal((await x.verify.POST(x.request({token:old},'','/api/firm-claims/verify'))).status,400);assert.equal((await x.verify.POST(x.request({token:latest},'','/api/firm-claims/verify'))).status,200);assert.equal(await x.access.firmAccess('manager','alpha'),false);}finally{x.sql.close();}});

test('individual attorney claim confirmations also accept old unused links and reject replay',async()=>{const x=await fixture();try{const token='cd'.repeat(32),hash=nodeCrypto.createHash('sha256').update(token).digest('hex');x.sql.prepare("INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,submitted_at,firm_email,email_token_hash,email_token_expires) VALUES('individual','100002','manager','manager@example.test','Manager Person','evidence','pending','now','manager@beta.example',?,1)").run(hash);const route=await x.load('app/api/claim-email/route.ts');assert.equal((await route.POST(x.request({token},'','/api/claim-email'))).status,200);assert.equal((await route.POST(x.request({token},'','/api/claim-email'))).status,400);assert.equal(x.sql.prepare("SELECT status FROM profile_claims WHERE id='individual'").get().status,'pending');}finally{x.sql.close();}});

test('matching firm email activates access immediately, audits it, and never replaces another owner',async()=>{const x=await fixture();try{
 x.sql.exec("UPDATE firm_settings SET website='https://www.alpha.example/team' WHERE key='alpha'");
 const claim=await x.claim(),token=x.token();x.sql.prepare('UPDATE firm_claims SET email_token_expires=1 WHERE id=?').run(claim.id);
 const response=await x.verify.POST(x.request({token},'','/api/firm-claims/verify'));
 assert.deepEqual(await response.json(),{confirmed:true,approved:true});
 assert.equal(await x.access.firmAccess('manager','alpha'),true);
 assert.equal(await x.access.firmAccess('manager','beta'),false);
 assert.equal(x.sql.prepare('SELECT reviewed_by FROM firm_claims WHERE id=?').get(claim.id).reviewed_by,'system:firm-email');
 assert.equal(x.sql.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action='firm-access-auto-approved'").get().n,1);
 assert.equal((await x.verify.POST(x.request({token},'','/api/firm-claims/verify'))).status,400);
 await x.claim('rival');const rival=await x.verify.POST(x.request({token:x.token()},'','/api/firm-claims/verify'));
 assert.deepEqual(await rival.json(),{confirmed:true,approved:false});assert.equal(await x.access.firmAccess('rival','alpha'),false);
 assert.equal(await x.access.firmAccess('manager','alpha'),true);
 }finally{x.sql.close();}});

test('directory email domain can activate existing links, but lookalikes and rejected claims cannot',async()=>{const x=await fixture();try{
 x.sql.exec("UPDATE attorneys SET email='contact@alpha.example' WHERE bar_number='100001'");
 const helper=await x.load('db/firm-claim-auto.ts');
 assert.equal(await helper.trustedFirmEmail('alpha','media@alpha.example'),true);
 assert.equal(await helper.trustedFirmEmail('alpha','media@alpha.example.evil.test'),false);
 assert.equal(await helper.trustedFirmEmail('beta','media@alpha.example'),false);
 const claim=await x.claim(),token=x.token();
 x.sql.prepare("UPDATE firm_claims SET status='rejected' WHERE id=?").run(claim.id);
 assert.equal((await x.verify.POST(x.request({token},'','/api/firm-claims/verify'))).status,400);
 assert.equal(await x.access.firmAccess('manager','alpha'),false);
 }finally{x.sql.close();}});

test('reviewed Thrift firm alias shares roster and approved access without merging unrelated legal suffixes',async()=>{const x=await fixture();try{
 const names=await x.load('app/api/attorneys/firm.ts');
 assert.equal(names.firmKey('Thrift McLemore'),names.firmKey('Thrift McLemore LLC'));
 assert.notEqual(names.firmKey('Unrelated Firm'),names.firmKey('Unrelated Firm LLC'));
 for(let i=0;i<14;i++)x.seed('thrift-'+i,'Thrift Lawyer '+i,i<3?'Thrift McLemore':'Thrift McLemore LLC');
 x.sql.exec("INSERT INTO firm_settings(key,name,website,updated_at) VALUES('thriftmclemorellc','Thrift McLemore LLC','https://thriftlegal.com','now'); INSERT INTO firm_claims(id,firm_key,firm_name,user_id,firm_email,authority,status,submitted_at) VALUES('old-thrift','thriftmclemore','Thrift McLemore','manager','media@thriftlegal.com','Co-founder','rejected','old')");
 const candidate=await x.load('db/account-firm.ts');assert.equal((await candidate.accountFirm('manager')).key,'thriftmclemorellc');
 assert.equal(await x.access.firmAccess('manager','thriftmclemorellc'),false);
 const granted=await x.admin.POST(x.request({action:'grant',firm:'Thrift McLemore',email:'manager@example.test',verified:true},adminTestCookie,'/api/admin/firm-claims'));assert.equal(granted.status,200,JSON.stringify(await granted.clone().json()));
 assert.equal(x.sql.prepare("SELECT status FROM firm_claims WHERE id='old-thrift'").get().status,'approved');
 for(const name of ['Thrift McLemore','Thrift McLemore LLC']){
  const key=names.firmKey(name);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorneys WHERE '+names.firmColumn()+'=?').get(key).n,14);
  const response=await x.management.GET(x.request({},x.cookies.manager,'/api/firm-management?firm='+encodeURIComponent(name)));
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.canManage,true);assert.equal(data.firm.key,'thriftmclemorellc');
 }
 assert.equal(await x.access.firmAttorneyAccess('manager','thrift-0'),true);assert.equal(await x.access.firmAttorneyAccess('manager','thrift-13'),true);assert.equal(await x.access.firmAttorneyAccess('rival','thrift-0'),false);
 const plan=x.sql.prepare('EXPLAIN QUERY PLAN SELECT bar_number FROM attorneys WHERE '+names.firmColumn()+'=?').all('thriftmclemorellc');assert.ok(plan.some(r=>r.detail.includes('attorneys_firm_key_idx')));
 }finally{x.sql.close();}});


test('admin firm editor shows the public website from published submissions and respects saved overrides',async()=>{const x=await fixture();try{
 x.sql.exec("UPDATE firm_settings SET website='' WHERE key='alpha'");
 x.sql.prepare("INSERT INTO directory_submissions(id,kind,name,state,website,official_source_url,submitter_name,submitter_email,status,submitted_at,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run('alpha-published','firm','Alpha','GA','https://published-alpha.example/','https://source.example/','Submitter','submitter@example.test','published','now','now');
 const records=await x.load('app/api/admin/records/route.ts'),publicRoute=await x.load('app/api/attorneys/route.ts');
 const read=async()=>{const response=await records.GET(x.request(null,adminTestCookie,'/api/admin/records?kind=firms&q=Alpha'));assert.equal(response.status,200);return (await response.json()).records[0];};
 const publicPage=await(await publicRoute.GET(new Request('https://lawvetter.test/api/attorneys?firm=Alpha'))).json();
 assert.equal((await read()).website,'https://published-alpha.example/');assert.equal((await read()).website,publicPage.firm.website);
 x.sql.exec("UPDATE firm_settings SET website='https://saved-alpha.example/' WHERE key='alpha'");assert.equal((await read()).website,'https://saved-alpha.example/');
 x.sql.exec("UPDATE firm_settings SET website='' WHERE key='alpha';UPDATE directory_submissions SET status='pending' WHERE id='alpha-published'");assert.equal((await read()).website,'');
 x.sql.exec("UPDATE attorney_profiles SET website='https://linked-alpha.example/' WHERE bar_number='100001'");assert.equal((await read()).website,'https://linked-alpha.example/');
 }finally{x.sql.close();}});

test('admin attorney pagination keeps name and recent ordering before profile and firm joins',async()=>{const x=await fixture();try{
 for(let i=0;i<65;i++)x.seed('page-'+i,'Paged Lawyer '+String(i).padStart(2,'0'),'Paged Firm');
 const api=await x.load('app/api/admin/records/route.ts');
 for(const sort of ['name','recent'])for(const page of [0,1]){
  const response=await api.GET(x.request(null,adminTestCookie,`/api/admin/records?kind=attorneys&q=Paged&sort=${sort}&page=${page}`));assert.equal(response.status,200);const body=await response.json();
  const expected=x.sql.prepare("SELECT bar_number FROM attorneys WHERE company='Paged Firm' ORDER BY "+(sort==='recent'?'rowid DESC':'name COLLATE NOCASE,bar_number')+' LIMIT 50 OFFSET ?').all(page*50).map(row=>row.bar_number);
  assert.equal(body.total,65);assert.deepEqual(body.records.map(row=>row.bar_number),expected);
 }
 const filtered=await api.GET(x.request(null,adminTestCookie,'/api/admin/records?kind=attorneys&state=GA&firmKey=Paged%20Firm'));const body=await filtered.json();assert.equal(filtered.status,200);assert.equal(body.total,65);assert.equal(body.records.length,50);
 }finally{x.sql.close();}});

test('admin firm listing uses the affiliation index without copying the entire directory',async()=>{const x=await fixture();try{
 x.sql.exec("INSERT INTO firm_settings(key,name,updated_at) VALUES('standalone','Standalone','now')");
 const captured=[],prepare=x.db.prepare;
 x.db.prepare=function(query){const statement=prepare(query),bind=statement.bind;let args=[];statement.bind=function(...values){args=values;return bind.apply(this,values);};const all=statement.all;statement.all=async function(){if(query.startsWith('WITH directory'))captured.push(x.sql.prepare('EXPLAIN QUERY PLAN '+query).all(...args).map(row=>row.detail).join('\n'));return all.apply(this);};return statement;};
 const api=await x.load('app/api/admin/records/route.ts');
 for(const sort of ['name','recent']){const response=await api.GET(x.request(null,adminTestCookie,'/api/admin/records?kind=firms&sort='+sort));assert.equal(response.status,200);const body=await response.json();assert.equal(body.total,3);assert.deepEqual(body.records.map(row=>row.name).sort(),['Alpha','Beta','Standalone']);}
 for(const plan of captured){assert.doesNotMatch(plan,/MATERIALIZE directory/);assert.match(plan,/SEARCH a USING INDEX attorneys_firm_key_idx/);}
 }finally{x.sql.close();}});
