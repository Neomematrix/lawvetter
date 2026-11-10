import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
async function load(file,mocks={}){
 const context=vm.createContext({Response,Request,URL,crypto:webcrypto});
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const module=new vm.SourceTextModule(code,{context});
 await module.link(spec=>{const values=mocks[spec];if(!values)throw Error(spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});});await module.evaluate();return module.namespace;
}
test('Phone validation accepts formatted and international numbers and rejects malformed values',async()=>{
 const {clientPhone}=await load('app/client-phone.ts');
 for(const phone of ['(404) 555-0123','+44 20 7946 0958','404.555.0123'])assert.equal(clientPhone(' '+phone+' ',true),phone);
 for(const phone of ['',undefined,'123','1234567890123456','call me','404-555-0123<script>',1234567890])assert.throws(()=>clientPhone(phone,true),/phone number/);
 assert.equal(clientPhone(undefined),'');
});
test('Signup requires phone for clients and persists it without changing attorney signup or login',async()=>{
 const {clientPhone}=await load('app/client-phone.ts');const {viewAsToken}=await load('db/view-as-cookie.ts');const batches=[];
 const db={prepare(sql){return {sql,bind(...args){return {sql,args,first:async()=>null};}};},batch:async statements=>{batches.push(statements);return [];}};
 const {POST}=await load('app/api/client-auth/route.ts',{
 '../../../db/automatic-profile-access':{syncEmailAccess:async()=>{},sendAccessConfirmation:async()=>{}},'../../../db/view-as-cookie':{viewAsToken},'../../client-phone':{clientPhone},'../../../db/form-input':{invalidPlainText:()=>false},
 '../../../db/directory-protection':{allowDirectoryAttempt:async()=>true,checkDirectoryCaptcha:async()=>null},
 '../../../db/raw':{rawDb:()=>db},'../../../db/profile-access':{profileIdentity:async()=>({user:null})},
 '../../../db/client-auth':{clientIdentity:async()=>null,hashPassword:()=> 'hash',checkPassword:()=>true,newSession:async()=> 'token',sessionCookie:()=> 'session=test',sessionToken:()=>'',digest:value=>value,allowAuth:async()=>true},
 '../../../db/password-reset-email':{passwordResetEmailConfigured:()=>false,sendPasswordResetEmail:async()=>false},'node:crypto':{randomBytes}
 });
 const preview=await POST(new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:'__Host-lawvetter-view-as=preview'},body:JSON.stringify({action:'logout'})}));assert.equal(preview.status,409);assert.equal(batches.length,0);
 const submit=payload=>POST(new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{origin:'https://lawvetter.test'},body:JSON.stringify({action:'register',accountType:'client',email:'client@example.com',firstName:'Test',lastName:'Client',password:'password123',consent:true,...payload})}));
 for(const phone of [undefined,'123','bad number']){const response=await submit({phone});assert.equal(response.status,400);assert.match((await response.json()).error,/phone number/);}
 assert.equal(batches.length,0);
 assert.equal((await submit({phone:'(404) 555-0123'})).status,201);
 assert.match(batches[0][0].sql,/initial_docket,phone/);assert.equal(batches[0][0].args.at(-1),'(404) 555-0123');
 assert.equal((await submit({accountType:undefined})).status,201);assert.equal(batches[1][0].args.at(-1),'');
});
test('Phone migration preserves existing clients and accepts saved phone numbers',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE client_profiles(user_id TEXT PRIMARY KEY,legal_name TEXT NOT NULL,email TEXT NOT NULL)');db.exec("INSERT INTO client_profiles VALUES('existing','Existing Client','existing@example.com')");db.exec(fs.readFileSync('drizzle/0030_ancient_jasper_sitwell.sql','utf8'));
 assert.equal(db.prepare('SELECT phone FROM client_profiles').get().phone,'');db.prepare('UPDATE client_profiles SET phone=? WHERE user_id=?').run('(404) 555-0123','existing');assert.equal(db.prepare('SELECT phone FROM client_profiles').get().phone,'(404) 555-0123');db.close();
});
