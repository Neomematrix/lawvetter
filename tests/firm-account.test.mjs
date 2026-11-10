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


test('normal firm sign-in and admin View as user resolve the same firm and two-attorney public roster',async()=>{
 const x=await runtime(),firm='Grimes and Fertitta';x.sql.prepare('INSERT INTO firm_settings(key,name,updated_at) VALUES(?,?,?)').run('grimesandfertitta',firm,new Date().toISOString());
 x.seed('TX:one','Julian Fertitta',firm);x.seed('TX:two','Richard Grimes',firm);
 x.sql.prepare("UPDATE attorneys SET state='TX',city='Houston'").run();
 x.sql.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at,first_name,last_name,initial_docket) VALUES(?,?,?,?,?,?,?)').run('client:firm',firm,'firm@example.com',new Date().toISOString(),'Grimes','and Fertitta','');
 const clientAuth=await x.load('db/client-auth.ts'),clientToken=await clientAuth.newSession('client:firm'),account=await x.load('app/api/client-reviews/route.ts'),view=await x.load('app/api/admin/view-as/route.ts'),dashboard=await x.load('db/account-dashboard.ts'),publicApi=await x.load('app/api/attorneys/route.ts');
 const read=cookie=>account.POST(new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{origin:'https://lawvetter.test',cookie,'Content-Type':'application/json'},body:JSON.stringify({action:'account'})}));
 const normal=await read('__Host-lawvetter-client='+clientToken);assert.equal(normal.status,200);const normalData=await normal.json();assert.equal(normalData.firm.name,firm);assert.equal(normalData.requests.length,0);
 const start=await view.POST(new Request('https://lawvetter.test/api/admin/view-as',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:adminTestCookie},body:JSON.stringify({action:'start',userId:'client:firm'})}));assert.equal(start.status,200);assert.equal((await start.json()).redirect,'/client-reviews');
 const viewCookie=adminTestCookie+'; '+start.headers.get('set-cookie').split(';')[0],preview=await read(viewCookie);assert.equal(preview.status,200);assert.deepEqual((await preview.json()).firm,normalData.firm);
 const list=await view.GET(new Request('https://lawvetter.test/api/admin/view-as?kind=firm',{headers:{cookie:adminTestCookie}}));assert.equal(list.status,200);const listed=await list.json();assert.equal(listed.users[0].role,'Firm');assert.equal(listed.total,1);
 const publicResponse=await publicApi.GET(new Request('https://lawvetter.test/api/attorneys?firm='+encodeURIComponent(normalData.firm.name)));assert.equal(publicResponse.status,200);const roster=await publicResponse.json();assert.equal(roster.firm.total,2);assert.deepEqual(roster.attorneys.map(a=>a.name).sort(),['Julian Fertitta','Richard Grimes']);
 assert.equal(await dashboard.accountDashboardPath({user:'client:firm',email:'firm@example.com'}),'/client-reviews');
 const profiles=await x.load('app/api/profiles/route.ts');const permission=await profiles.POST(new Request('https://lawvetter.test/api/profiles',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:viewCookie},body:JSON.stringify({action:'view',bar:'TX:one'})}));const rights=await permission.json();assert.equal(rights.isOwner,false);assert.equal(rights.isAdmin,false);
 x.sql.close();
});
test('ordinary clients retain their client dashboard and unrelated accounts cannot gain firm ownership',async()=>{
 const x=await runtime();x.sql.prepare('INSERT INTO firm_settings(key,name,updated_at) VALUES(?,?,?)').run('grimesandfertitta','Grimes and Fertitta',new Date().toISOString());x.sql.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES(?,?,?,?)').run('client:ordinary','Ordinary Client','client@example.com',new Date().toISOString());
 const helper=await x.load('db/account-firm.ts'),dashboard=await x.load('db/account-dashboard.ts');assert.equal(await helper.accountFirm('client:ordinary'),null);assert.equal(await helper.accountFirm('missing'),null);assert.equal(await dashboard.accountDashboardPath({user:'client:ordinary',email:'client@example.com'}),'/client-reviews');x.sql.close();
});

test('dual-role accounts can explicitly open their lawyer workspace while keeping the firm dashboard',async()=>{
 const x=await runtime();try{x.seed('dual-lawyer','Dual Lawyer','Dual Firm');x.sql.exec("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES('dual','Dual Firm','dual@example.test','now'); INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES('dual-lawyer','dual','approved','now')");
 const dashboard=await x.load('db/account-dashboard.ts'),client={user:'dual',email:'dual@example.test'};
 assert.equal(await dashboard.accountDashboardPath(client),'/client-reviews');
 assert.equal(await dashboard.accountDashboardPath(client,true),'/account');
 assert.equal(await dashboard.accountDashboardPath({user:'missing',email:'missing@example.test'},true),'/client-reviews');
 }finally{x.sql.close();}
});

test('claimed profiles admin list counts actual owners and supports search without exposing data to guests',async()=>{
 const x=await runtime();try{
 x.seed('claimed','Claimed Lawyer','Example Firm');x.seed('unclaimed','Unclaimed Lawyer');
 x.sql.exec("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES('owner','Owner Name','owner@example.test','now'); INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES('claimed','owner','2026-11-01','now'),('unclaimed','','','now')");
 const route=await x.load('app/api/admin/claimed-profiles/route.ts');
 assert.equal((await route.GET(new Request('https://lawvetter.test/api/admin/claimed-profiles'))).status,401);
 const read=q=>route.GET(new Request('https://lawvetter.test/api/admin/claimed-profiles?q='+q,{headers:{cookie:adminTestCookie}}));
 const result=await (await read('')).json();assert.equal(result.total,1);assert.equal(result.profiles[0].owner_email,'owner@example.test');
 assert.equal((await (await read('nomatch')).json()).total,0);
 assert.equal((await (await read('Owner')).json()).total,1);
 const overview=await x.load('app/api/admin/overview/route.ts');const response=await overview.GET(new Request('https://lawvetter.test/api/admin/overview',{headers:{cookie:adminTestCookie}}));assert.equal(response.status,200);assert.equal((await response.json()).totals.claimedProfiles,1);
 }finally{x.sql.close();}
});
