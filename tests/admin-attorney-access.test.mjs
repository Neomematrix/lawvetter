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


async function fixture(){const x=await runtime();x.seed('1001','Attorney One');x.seed('1002','Attorney Two');x.sql.exec("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES('one','User One','one@example.test','now'),('two','User Two','two@example.test','now'); INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio,photo_key) VALUES('1001','','','now','Keep biography','keep-photo')");const api=await x.load('app/api/admin/attorney-access/route.ts');function req(body,cookie=adminTestCookie,origin='https://lawvetter.test',query='bar=1001&q=one%40example.test'){return new Request('https://lawvetter.test/api/admin/attorney-access?'+query,{method:body?'POST':'GET',headers:{cookie,origin},...(body?{body:JSON.stringify(body)}:{})});}async function selection(bar='1001',query='one@example.test'){const r=await api.GET(req(null,adminTestCookie,'https://lawvetter.test','bar='+bar+'&q='+query));return (await r.json()).users[0];}return {...x,api,req,selection};}
test('admin can search minimal account data and assign access atomically, preserving profile and firm ownership',async()=>{const x=await fixture();try{
 const u=await x.selection();assert.deepEqual(Object.keys(u).sort(),['email','fingerprint','legal_name','user_id']);
 const body={bar:'1001',userId:u.user_id,fingerprint:u.fingerprint,verified:true};
 assert.equal((await x.api.POST(x.req({...body,verified:false}))).status,400);
 assert.equal((await x.api.POST(x.req(body))).status,200);
 const profile=x.sql.prepare("SELECT * FROM attorney_profiles WHERE bar_number='1001'").get();assert.equal(profile.owner_id,'one');assert.equal(profile.bio,'Keep biography');assert.equal(profile.photo_key,'keep-photo');assert.ok(profile.claimed_at);
 const claim=x.sql.prepare("SELECT * FROM profile_claims WHERE user_id='one'").get();assert.equal(claim.status,'approved');assert.equal(claim.reviewed_by,'admin@example.test');
 assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM firm_owners').get().n,0);
 assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='attorney-access-assigned'").get().n,1);
 assert.equal((await x.api.POST(x.req(body))).status,200);assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='attorney-access-assigned'").get().n,1);
 }finally{x.sql.close();}});
test('only authenticated same-origin administrators may link; stale selections and missing accounts are blocked',async()=>{const x=await fixture();try{
 assert.equal((await x.api.GET(x.req(null,''))).status,401);const u=await x.selection(),body={bar:'1001',userId:u.user_id,fingerprint:u.fingerprint,verified:true};
 assert.equal((await x.api.POST(x.req(body,''))).status,401);assert.equal((await x.api.POST(x.req(body,adminTestCookie,'https://evil.test'))).status,403);
 x.sql.exec("UPDATE client_profiles SET email='changed@example.test' WHERE user_id='one'");assert.equal((await x.api.POST(x.req(body))).status,409);
 x.sql.exec("DELETE FROM client_profiles WHERE user_id='one'");assert.equal((await x.api.POST(x.req(body))).status,404);assert.equal(x.sql.prepare("SELECT owner_id FROM attorney_profiles WHERE bar_number='1001'").get().owner_id,'');
 }finally{x.sql.close();}});
test('ownership races cannot replace another owner or give one account two attorney identities',async()=>{const x=await fixture();try{
 const one=await x.selection(),two=await x.selection('1001','two@example.test'),other=await x.selection('1002');
 assert.equal((await x.api.POST(x.req({bar:'1001',userId:one.user_id,fingerprint:one.fingerprint,verified:true}))).status,200);
 assert.equal((await x.api.POST(x.req({bar:'1001',userId:two.user_id,fingerprint:two.fingerprint,verified:true}))).status,409);
 assert.equal((await x.api.POST(x.req({bar:'1002',userId:other.user_id,fingerprint:other.fingerprint,verified:true}))).status,409);
 assert.equal(x.sql.prepare("SELECT owner_id FROM attorney_profiles WHERE bar_number='1001'").get().owner_id,'one');
 }finally{x.sql.close();}});
test('pending selected claim is approved and competing claim tokens are invalidated',async()=>{const x=await fixture();try{
 for(const user of ['one','two'])x.sql.prepare("INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,submitted_at,email_token_hash) VALUES(?,'1001',?,?,'Person','Pending evidence','pending','now','old-token')").run(JSON.stringify([user,'1001']),user,user+'@example.test');
 const u=await x.selection();assert.equal((await x.api.POST(x.req({bar:'1001',userId:u.user_id,fingerprint:u.fingerprint,verified:true}))).status,200);
 const rows=x.sql.prepare('SELECT user_id,status,email_token_hash FROM profile_claims ORDER BY user_id').all();assert.deepEqual(rows.map(r=>[r.user_id,r.status,r.email_token_hash]),[['one','approved',''],['two','rejected','']]);
 }finally{x.sql.close();}});
