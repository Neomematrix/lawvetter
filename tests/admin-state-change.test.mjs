import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

test('Admin can correct state without replacing profile identity; other callers and duplicate identities remain blocked',async()=>{
 const context=vm.createContext({crypto:webcrypto});
 let matched=null,batch=[];
 const target={bar_number:'815100',state:'FL',name:'James Rockefeller',license_number:'815100'};
 const db={prepare(sql){return {bind(...args){return {sql,args,first:async()=>target};}};},async batch(statements){batch=statements;return statements.map(()=>({meta:{changes:1}}));}};
 const mocks={normalizeLanguages:x=>x||'',RETIRED:'Retired',employmentType:x=>x||'Law Firm Attorney',verifiedEmployer:()=>undefined,isActiveMembership:()=>true,validatedMembershipStatus:x=>x,requireAttorneyLocation:()=>{},linkedInUrl:x=>x,assertAttorneyAllowed:async()=>{},assertFirmAllowed:async()=>{},directoryInsertGuard:'1',licenseKey:(s,n)=>s+':'+n,firmDeletionKey:x=>x,normalizeBarNumber:(s,n)=>n,georgiaBarProfile:()=>'',requireGeorgiaIdentity:()=>{},validAttorneyId:()=>true,firmKey:x=>x,rawDb:()=>db,licensedAttorney:async()=>matched,directoryAttorneyId:async()=>{throw Error('Must retain existing ID');}};
 const code=ts.transpileModule(fs.readFileSync('db/admin-records.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});
 await mod.link(()=>new vm.SyntheticModule(Object.keys(mocks),function(){for(const [k,v] of Object.entries(mocks))this.setExport(k,v);},{context}));await mod.evaluate();
 const record={recordId:'815100',state:'GA',barNumber:'815100',name:'James Rockefeller',city:'Warner Robins',status:'Member in Good Standing'};
 await assert.rejects(()=>mod.namespace.saveAttorney(record,'admin',false,false,true),/state cannot be changed/);
 const result=await mod.namespace.saveAttorney(record,'admin',false,false,true,true);
 assert.equal(result.id,'815100');assert.equal(result.created,false);
 assert.match(batch[0].sql,/ON CONFLICT\(bar_number\) DO UPDATE SET state=excluded.state/);
 assert.equal(batch[0].args[0],'815100');assert.equal(batch[0].args[3],'GA');
 matched={bar_number:'other-profile'};
 await assert.rejects(()=>mod.namespace.saveAttorney(record,'admin',false,false,true,true),/already assigned/);
});
