import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

async function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE directory_submissions(id TEXT PRIMARY KEY,kind TEXT,name TEXT,state TEXT,bar_number TEXT,submitter_name TEXT,submitter_email TEXT,notes TEXT,status TEXT,reviewed_at TEXT);CREATE TABLE attorneys(bar_number TEXT,source_id TEXT);");
 const notes=JSON.stringify({notes:'Private review information',firmWebsite:'https://firm.example',biography:'Biography'});
 for(const [id,kind] of [['lawyer','lawyer'],['firm','firm']])sql.prepare('INSERT INTO directory_submissions VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,kind,'Example <Law>','FL','123','Submitter','submitter@example.com',notes,'pending','today');
 sql.exec("INSERT INTO attorneys VALUES('FL:123','owner-reviewed:lawyer')");
 const db={prepare(query){const stmt=sql.prepare(query);let args=[];return {bind(...values){args=values;return this;},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return {meta:stmt.run(...args)};}};}};
 const calls=[];let fail=false;const context=vm.createContext({Response,AbortSignal,Date,JSON,encodeURIComponent,fetch:async(url,options)=>{calls.push({body:JSON.parse(options.body),key:options.headers['Idempotency-Key']});return Response.json(fail?{error:'failed'}:{id:'sent'},{status:fail?500:200});}});
 const mocks={'cloudflare:workers':{env:{RESEND_API_KEY:'test'}},'./raw':{rawDb:()=>db},'./directory-details':{directoryDetails:JSON.parse,withDirectoryDetails:(notes,changes)=>JSON.stringify({...JSON.parse(notes),...changes})},'./mail-markup':{escapeHtml:s=>s.replaceAll('<','&lt;').replaceAll('>','&gt;'),mailButton:(label,url)=>`<a href="${url}">${label}</a>`}};
 const mod=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('db/directory-approval-email.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,{context});
 await mod.link(spec=>{const values=mocks[spec];return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});await mod.evaluate();
 return {sql,calls,send:mod.namespace.sendDirectoryApproval,retry:mod.namespace.retryDirectoryApprovals,fail:value=>{fail=value;}};
}
test('Only published listings notify the submitter, with the correct public link and no private notes',async()=>{
 const f=await fixture();try{
  assert.equal(await f.send('lawyer'),'unavailable');assert.equal(f.calls.length,0);
  f.sql.exec("UPDATE directory_submissions SET status='published'");
  for(const id of ['lawyer','firm']){assert.equal(await f.send(id),'accepted');const mail=f.calls.at(-1);assert.equal(mail.body.to[0],'submitter@example.com');assert.match(mail.body.html,/Example &lt;Law&gt;/);assert.doesNotMatch(mail.body.text,/Private review information/);assert.match(mail.body.text,id==='firm'?/firm\?name=Example%20%3CLaw%3E/:/attorney\?bar=FL%3A123&state=FL/);}
  await f.send('lawyer');await f.retry();assert.equal(f.calls.length,2,'Accepted notifications do not resend');
 }finally{f.sql.close();}
});
test('Provider failures keep the listing published and retry the same email safely',async()=>{
 const f=await fixture();try{
  f.sql.exec("UPDATE directory_submissions SET status='published' WHERE id='firm'");f.fail(true);assert.equal(await f.send('firm'),'pending');assert.equal(f.sql.prepare("SELECT status FROM directory_submissions WHERE id='firm'").get().status,'published');
  f.fail(false);await f.retry();assert.equal(f.calls.length,2);assert.equal(f.calls[0].key,f.calls[1].key);assert.deepEqual(f.calls[0].body,f.calls[1].body);assert.equal(JSON.parse(f.sql.prepare("SELECT notes FROM directory_submissions WHERE id='firm'").get().notes).approvalNotice.status,'accepted');
 }finally{f.sql.close();}
});
