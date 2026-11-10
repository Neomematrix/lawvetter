import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import * as crypto from 'node:crypto';
import ts from 'typescript';

async function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE firm_claims(user_id TEXT);CREATE TABLE firm_settings(key TEXT,name TEXT);CREATE TABLE attorneys(company TEXT);CREATE TABLE admin_credentials(email TEXT);CREATE TABLE admin_sessions(token_hash TEXT,email TEXT,expires_at INTEGER,last_seen INTEGER);CREATE TABLE client_profiles(user_id TEXT PRIMARY KEY,email TEXT,legal_name TEXT);CREATE TABLE client_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE attorney_profiles(owner_id TEXT);CREATE TABLE profile_claims(user_id TEXT);CREATE TABLE admin_audit(id TEXT,actor TEXT,action TEXT,record_id TEXT,created_at TEXT);`);sql.exec(fs.readFileSync('drizzle/0035_lucky_firebrand.sql','utf8'));sql.exec(fs.readFileSync('drizzle/0040_certain_magdalene.sql','utf8'));
 const db={prepare(query){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};return statement;},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),adminToken='a'.repeat(64),otherToken='b'.repeat(64),normalToken='c'.repeat(64),email='owner@example.com';
 sql.prepare('INSERT INTO admin_credentials VALUES(?)').run(email);for(const token of [adminToken,otherToken])sql.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?)').run(hash(token),email,Date.now()+7200000,Date.now());
 sql.exec("INSERT INTO client_profiles VALUES('client:one','client@example.com','Client One'),('client:attorney','lawyer@example.com','Attorney One'),('client:normal','normal@example.com','Normal User');INSERT INTO attorney_profiles VALUES('client:attorney');");sql.prepare('INSERT INTO client_sessions VALUES(?,?,?)').run(hash(normalToken),'client:normal',Date.now()+7200000);
 const context=vm.createContext({Request,Response,URL,Date,crypto:crypto.webcrypto,Buffer,console}),cache=new Map();
 function moduleFor(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const mod=new vm.SourceTextModule(code,{context,identifier:file});cache.set(file,mod);return mod;}
 function dependency(spec,file){if(spec==='node:crypto'||spec==='cloudflare:workers'||spec.endsWith('/account-dashboard')){const exports=spec==='node:crypto'?crypto:spec==='cloudflare:workers'?{env:{DB:db,CLAIM_ADMIN_EMAIL:email}}:{accountDashboardPath:async user=>user.user==='client:attorney'?'/account':'/client-reviews'};return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});}return moduleFor(path.resolve(path.dirname(file),spec+'.ts'));}
 async function load(file){const mod=moduleFor(file);if(mod.status==='unlinked')await mod.link((spec,ref)=>dependency(spec,ref.identifier));return mod;}
 const route=await load('app/api/admin/view-as/route.ts');await route.evaluate();const client=await load('db/client-auth.ts');await client.evaluate();const profile=await load('db/profile-access.ts');await profile.evaluate();const admin=await load('db/admin-auth.ts');await admin.evaluate();
 const baseCookie=`__Host-lawvetter-admin=${adminToken}; __Host-lawvetter-client=${normalToken}`;
 function request(body,{cookie=baseCookie,origin='https://lawvetter.test',query=''}={}){return new Request('https://lawvetter.test/api/admin/view-as'+query,{method:body?'POST':'GET',headers:{cookie,origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
 return {sql,route:route.namespace,client:client.namespace,profile:profile.namespace,admin:admin.namespace,request,baseCookie,otherToken,hash};
}

test('only a current administrator can list/start a same-origin user view',async()=>{const s=await setup();try{
 assert.equal((await s.route.GET(s.request(null,{cookie:''}))).status,401);
 assert.equal((await s.route.POST(s.request({action:'start',userId:'client:one'},{cookie:''}))).status,401);
 assert.equal((await s.route.POST(s.request({action:'start',userId:'client:one'},{origin:'https://evil.test'}))).status,403);
 assert.equal((await s.route.POST(s.request({action:'start',userId:'missing'}))).status,404);
 const list=await (await s.route.GET(s.request(null,{query:'?kind=attorney&q=lawyer'}))).json();assert.equal(list.users.length,1);assert.equal(list.users[0].role,'Attorney');assert.equal(list.users[0].user_id,'client:attorney');
 assert.equal(s.sql.prepare('SELECT COUNT(*) n FROM admin_user_views').get().n,0);
 }finally{s.sql.close();}});

test('viewing clients and attorneys uses their identity without admin permissions; exit restores original sessions',async()=>{const s=await setup();try{
 for(const [userId,destination] of [['client:one','/client-reviews'],['client:attorney','/account']]){
 const response=await s.route.POST(s.request({action:'start',userId}));assert.equal(response.status,200);assert.equal((await response.json()).redirect,destination);const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly; Secure; SameSite=Strict/);const cookie=s.baseCookie+'; '+setCookie.split(';')[0],req=s.request(null,{cookie});
 assert.equal((await s.client.clientIdentity(req)).user,userId);const identity=await s.profile.profileIdentity(req);assert.equal(identity.user,userId);assert.equal(identity.admin,false);assert.equal(await s.admin.adminIdentity(req),null);
 assert.equal((await (await s.route.GET(s.request(null,{cookie,query:'?status=1'}))).json()).active,true);
 const stolen=cookie.replace('a'.repeat(64),s.otherToken);assert.equal(await s.client.clientIdentity(s.request(null,{cookie:stolen})),null);
 const exit=await s.route.POST(s.request({action:'stop'},{cookie}));assert.equal(exit.status,200);assert.match(exit.headers.get('set-cookie'),/Max-Age=0/);assert.equal(s.sql.prepare('SELECT COUNT(*) n FROM admin_user_views').get().n,0);
 assert.equal((await s.client.clientIdentity(s.request())).user,'client:normal');assert.equal((await s.admin.adminIdentity(s.request())).admin,true);
 }
 assert.equal(s.sql.prepare('SELECT COUNT(*) n FROM client_sessions').get().n,1);assert.equal(s.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,4);
 }finally{s.sql.close();}});

test('expired, deleted and revoked views fail closed and can always be exited',async()=>{const s=await setup();try{
 for(const invalidate of [()=>s.sql.exec('UPDATE admin_user_views SET expires_at=0'),()=>s.sql.exec("DELETE FROM client_profiles WHERE user_id='client:one'"),()=>s.sql.exec('DELETE FROM admin_sessions')]){
 s.sql.exec("INSERT OR IGNORE INTO client_profiles VALUES('client:one','client@example.com','Client One')");const start=await s.route.POST(s.request({action:'start',userId:'client:one'}));assert.equal(start.status,200);const cookie=s.baseCookie+'; '+start.headers.get('set-cookie').split(';')[0];invalidate();const req=s.request(null,{cookie});assert.equal(await s.client.clientIdentity(req),null);const identity=await s.profile.profileIdentity(req);assert.equal(identity.user,'');assert.equal(identity.admin,false);
 const state=await (await s.route.GET(s.request(null,{cookie,query:'?status=1'}))).json();assert.equal(state.expired,true);assert.equal(state.active,false);
 assert.equal((await s.route.POST(s.request({action:'stop'},{cookie}))).status,200);
 }
 }finally{s.sql.close();}});
