import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import * as cryptoModule from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import * as engine from '../lib/enrichment/engine.mjs';
import * as sources from '../lib/enrichment/sources.mjs';
import * as images from '../lib/enrichment/images.mjs';
import * as capabilities from '../lib/enrichment/research-db.mjs';
async function runtime(){
 const sql=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
 const db={prepare(q){return {bind(...args){this.args=args;return this;},async first(){return sql.prepare(q).get(...(this.args||[]))||null;},async all(){return {results:sql.prepare(q).all(...(this.args||[]))};},async run(){return {meta:{changes:sql.prepare(q).run(...(this.args||[])).changes}};}};},async batch(statements){sql.exec('BEGIN');try{const result=await Promise.all(statements.map(s=>s.run()));sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const token='ef'.repeat(32),env={DB:db,CLAIM_ADMIN_EMAIL:'owner@example.test',PROFILE_PHOTOS:{async get(){return null;}}};
 sql.prepare('INSERT INTO admin_credentials(email,password_hash,updated_at) VALUES(?,?,?)').run(env.CLAIM_ADMIN_EMAIL,'fixture','now');sql.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(cryptoModule.createHash('sha256').update(token).digest('hex'),env.CLAIM_ADMIN_EMAIL,Date.now()+60000);
 const context=vm.createContext({console,Request,Response,URL,Date,File,FormData,Blob,Uint8Array,TextDecoder,TextEncoder}),cache=new Map();
 const synthetic=async(value,key)=>{const mod=new vm.SyntheticModule(Object.keys(value),function(){for(const [k,v] of Object.entries(value))this.setExport(k,v);},{context});cache.set(key,mod);await mod.link(()=>{});return mod;};
 async function load(file){if(cache.has(file))return cache.get(file);
  if(file==='cloudflare:workers')return synthetic({env},file);if(file==='node:crypto')return synthetic(cryptoModule,file);
  if(file.endsWith('engine.mjs'))return synthetic(engine,file);if(file.endsWith('sources.mjs'))return synthetic(sources,file);if(file.endsWith('images.mjs'))return synthetic(images,file);
  if(file.endsWith('research-db.mjs'))return synthetic(capabilities,file);
  const mod=new vm.SourceTextModule(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText,{context,identifier:file});cache.set(file,mod);
  await mod.link((specifier,parent)=>load(specifier.includes(':')?specifier:path.resolve(path.dirname(parent.identifier),specifier)+(path.extname(specifier)?'':'.ts')));return mod;
 }
 return {async api(file){const mod=await load(path.resolve(file));await mod.evaluate();return mod.namespace;},cookie:'__Host-lawvetter-admin='+token,env,sql};
}
test('real admin endpoints require owner session and same-origin mutations; spoofed platform headers cannot approve',async()=>{
 const x=await runtime(),api=await x.api('app/api/admin/enrichment/route.ts'),url='https://lawvetter.test/api/admin/enrichment';
 const req=(headers={},body={action:'scan'})=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://lawvetter.test',...headers},body:JSON.stringify(body)});
 assert.equal((await api.GET(new Request(url))).status,403);
 assert.equal((await api.POST(req({'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-id':'owner'}))).status,403);
 assert.equal((await api.POST(req({Cookie:x.cookie,Origin:'https://evil.test'}))).status,403);
 const absent=req({Cookie:x.cookie});absent.headers.delete('origin');assert.equal((await api.POST(absent)).status,403);
 const get=await api.GET(new Request(url,{headers:{Cookie:x.cookie}}));assert.equal(get.status,200);assert.equal(get.headers.get('cache-control'),'private, no-store');
 assert.equal((await api.POST(req({Cookie:x.cookie}))).status,202);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM enrichment_scans').get().n,1);
 assert.equal((await api.POST(req({Cookie:x.cookie},{action:'advance'}))).status,409,'source access disabled by default');
 assert.equal((await api.POST(req({Cookie:x.cookie},{action:'approved',ids:['missing']}))).status,409);
 const previews=await x.api('app/api/enrichment-image/route.ts');assert.equal((await previews.GET(new Request('https://lawvetter.test/api/enrichment-image?proposal=private-id'))).status,404);
 assert.equal((await previews.GET(new Request('https://lawvetter.test/api/enrichment-image?key=arbitrary-r2-object'))).status,404);
});
