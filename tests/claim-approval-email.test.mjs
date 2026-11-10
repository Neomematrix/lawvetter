import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
async function fixture(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 sql.exec(`INSERT INTO attorneys(bar_number,source_id,name,company,city,state,status,source_url,imported_at) VALUES('123','test','Attorney <Test>','','Atlanta','GA','Member in Good Standing','https://example.com',''); INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES('123','owner','',''); INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,submitted_at,reviewed_at,review_note) VALUES('claim','123','owner','registered@example.com','Attorney Test','checked','pending','','today','<review>');`);
 const db={prepare(query){const stmt=sql.prepare(query);let args=[];return {bind(...values){args=values;return this;},async first(){return stmt.get(...args)||null;}};}};
 let fail=false;const calls=[];const context=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,Array,JSON,AbortSignal,fetch:async(url,options)=>{calls.push({body:JSON.parse(options.body),headers:options.headers});return Response.json(fail?{error:'failed'}:{id:'sent'},{status:fail?500:200});}});
 const mocks={'cloudflare:workers':{env:{RESEND_API_KEY:'test'}},'./raw':{rawDb:()=>db},'./mail-markup':{escapeHtml:s=>s.replaceAll('<','&lt;').replaceAll('>','&gt;'),mailButton:(label,url)=>`<a href="${url}">${label}</a>`}};
 const mod=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('db/claim-approval-email.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,{context});
 await mod.link(specifier=>{const values=mocks[specifier];return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});await mod.evaluate();
 return {sql,calls,send:()=>mod.namespace.sendClaimApproval('claim'),fail:()=>{fail=true;}};
}
test('only an approved claim with matching ownership sends an approval message',async()=>{const f=await fixture();assert.equal(await f.send(),'unavailable');assert.equal(f.calls.length,0);f.sql.exec("UPDATE profile_claims SET status='approved';UPDATE attorney_profiles SET owner_id='another'");assert.equal(await f.send(),'unavailable');assert.equal(f.calls.length,0);f.sql.exec("UPDATE attorney_profiles SET owner_id='owner'");assert.equal(await f.send(),'accepted');assert.equal(f.calls[0].body.to[0],'registered@example.com');assert.match(f.calls[0].body.text,/existing LawVetter email and password/);assert.match(f.calls[0].body.html,/account\?bar=123/);assert.match(f.calls[0].body.html,/&lt;review&gt;/);assert.doesNotMatch(f.calls[0].body.html,/<Test>|<review>/);await f.send();assert.equal(f.calls[0].headers['Idempotency-Key'],f.calls[1].headers['Idempotency-Key']);f.sql.close();});
test('email provider failure is reported without undoing approved ownership',async()=>{const f=await fixture();f.sql.exec("UPDATE profile_claims SET status='approved'");f.fail();assert.equal(await f.send(),'unavailable');assert.equal(f.sql.prepare('SELECT status FROM profile_claims').get().status,'approved');assert.equal(f.sql.prepare('SELECT owner_id FROM attorney_profiles').get().owner_id,'owner');f.sql.close();});
