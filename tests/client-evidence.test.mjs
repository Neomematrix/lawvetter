import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function moduleAt(file,mocks={}){
 const context=vm.createContext({Response,Request,File,Uint8Array,URL});
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const module=new vm.SourceTextModule(code,{context});
 await module.link(spec=>{const values=mocks[spec];if(!values)throw Error(spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});await module.evaluate();return module.namespace;
}
test('PDF, PNG and JPEG are checked by content; disguised files and oversize files are rejected',async()=>{
 const {validateClientEvidence:check}=await moduleAt('db/client-evidence.ts');
 assert.equal(await check(null),null);
 for(const [magic,type] of [[[37,80,68,70,45],'application/pdf'],[[137,80,78,71,13,10,26,10],'image/png'],[[255,216,255],'image/jpeg']]){const bytes=new Uint8Array(30);bytes.set(magic);assert.equal((await check(new File([bytes],'record'))).type,type);}
 await assert.rejects(check(new File(['<html>not a PDF document</html>'],'fake.pdf',{type:'application/pdf'})),/Proof must/);
 await assert.rejects(check(new File([new Uint8Array(20*1024*1024+1)],'large.pdf')),/20 MB/);
});
test('Private evidence denies anonymous and unrelated clients; permits owner and admin without public caching',async()=>{
 for(const [user,admin,status] of [[null,false,404],['another-client',false,404],['owner',false,200],[null,true,200]]){
 let reads=0;
 const {GET}=await moduleAt('app/api/client-evidence/route.ts',{
 '../../../db/attorney-reference':{resolveVerificationReference:async x=>x},'cloudflare:workers':{env:{PROFILE_PHOTOS:{get:async()=>{reads++;return {body:'private evidence'};}}}},
 '../../../db/raw':{rawDb:()=>({prepare:()=>({bind:()=>({first:async()=>({user_id:'owner',evidence_key:'client-evidence/private.pdf',evidence_type:'application/pdf'})})})})},
 '../../../db/profile-access':{profileIdentity:async()=>({admin,user:''})},
 '../../../db/client-auth':{clientIdentity:async()=>user?{user}:null}
 });
 const result=await GET(new Request('https://example.com/api/client-evidence?id=request'));
 assert.equal(result.status,status);assert.equal(reads,status===200?1:0);
 if(status===200){assert.equal(result.headers.get('Cache-Control'),'private, no-store');assert.match(result.headers.get('Content-Disposition'),/^attachment;/);assert.equal(result.headers.get('X-Content-Type-Options'),'nosniff');}
 }
});
