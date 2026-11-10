import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
async function fixture(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 sql.exec("INSERT INTO attorneys(bar_number,source_id,name,company,city,state,status,source_url,imported_at) VALUES('123','test','Isaac Alexander Mazur','','Atlanta','GA','Member in Good Standing','https://example.com','')");
 const insert=sql.prepare('INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,submitted_at) VALUES(?,?,?,?,?,?,?,?)');for(let i=0;i<65;i++)insert.run('claim-'+i,'123','user-'+i,'user'+i+'@example.com','Claimant '+i,'checked',i<22?'pending':i<60?'approved':'rejected',new Date(Date.UTC(2026,9,1,0,i)).toISOString());
 const db={prepare(query){const stmt=sql.prepare(query);let args=[];return {bind(...a){args=a;return this;},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};}};}};
 let admin=true;
 const overrides={submissionInput:async request=>({data:await request.json(),photo:null}),profileIdentity:async()=>({user:'admin',email:'admin@example.com',admin}),clientIdentity:async()=>null,sameOrigin:()=>true,rawDb:()=>db};
 const source=fs.readFileSync('app/api/profiles/route.ts','utf8'),context=vm.createContext({Response,Request,URL,Date,JSON,Number,Math,Object,Array,console});
 const imports=new Map([...source.matchAll(/import \{([^}]+)\} from '([^']+)';/g)].map(m=>[m[2],m[1].split(',').map(v=>v.trim())]));
 const mod=new vm.SourceTextModule(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,{context});await mod.link(specifier=>{const names=imports.get(specifier);return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,overrides[name]||(()=>{}));},{context});});await mod.evaluate();
 return {sql,nonAdmin:()=>{admin=false;},request:async data=>mod.namespace.POST(new Request('https://lawvetter.com/api/profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review-list',...data})}))};
}
test('claim queue uses bounded pages, correct totals, pending-first ordering, and clamps invalid pages',async()=>{const f=await fixture();let r=await f.request({page:1}),d=await r.json();assert.equal(d.total,65);assert.equal(d.claims.length,20);assert.equal(d.counts.pending,22);assert.equal(d.claims[0].id,'claim-0');const first=d.claims.map(c=>c.id);d=await(await f.request({page:2})).json();assert.equal(d.claims.length,20);assert.ok(d.claims.every(c=>!first.includes(c.id)));assert.equal(d.claims[0].id,'claim-20');assert.equal(d.claims[2].id,'claim-64');d=await(await f.request({page:999})).json();assert.equal(d.page,4);assert.equal(d.claims.length,5);f.sql.close();});
test('claim filters and literal search apply to the complete queue; non-admins cannot read it',async()=>{const f=await fixture();let d=await(await f.request({status:'approved',query:'USER59@EXAMPLE.COM'})).json();assert.equal(d.total,1);assert.equal(d.claims[0].id,'claim-59');d=await(await f.request({status:'pending',query:'user59@example.com'})).json();assert.equal(d.total,0);d=await(await f.request({query:"' OR 1=1 --"})).json();assert.equal(d.total,0);f.nonAdmin();assert.equal((await f.request({})).status,403);f.sql.close();});
