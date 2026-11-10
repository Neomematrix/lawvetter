import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('Admin can approve a misclassified attorney draft as a firm and preserve its details',async()=>{
 const original={id:'firm-review',kind:'lawyer',name:'Arash Law',state:'GA',bar_number:'249405',city:'Los Angeles',website:'https://firm.example/',notes:'attorney draft',status:'pending'};
 const details={notes:'Submitted notes',firmWebsite:original.website,address:'123 Main St',phone:'2135550100',publicEmail:'info@firm.example',linkedinUrl:'https://www.linkedin.com/in/firm-name/'};
 const batch=[],approvalEmails=[];let admin=true;
 const overrides={sendDirectoryApproval:async id=>{approvalEmails.push(id);return 'accepted';},sameOrigin:()=>true,submissionInput:async request=>({data:await request.json()}),rawDb:()=>({prepare:sql=>({bind:(...values)=>({sql,values,first:async()=>original})}),batch:async statements=>{batch.push(...statements);return statements.map(()=>({meta:{changes:1}}));}}),profileIdentity:async()=>({user:'admin',admin}),directoryDetails:()=>details,decodeAttorneyDraft:()=>({photoKey:'existing-logo.png'}),withDirectoryDetails:(_notes,changes)=>JSON.stringify(changes),firmKey:name=>name.toLowerCase(),linkedInUrl:()=>{throw Error('Individual LinkedIn URL');}};
 const source=fs.readFileSync('app/api/directory-submissions/route.ts','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const module=new vm.SourceTextModule(code);
 await module.link(spec=>{const match=[...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].filter(m=>m[2]===spec);const names=[...new Set(match.flatMap(m=>m[1].split(',').map(n=>n.trim())))];return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,overrides[name]||(()=>undefined));});});await module.evaluate();
 const call=payload=>module.namespace.POST(new Request('https://lawvetter.com/api/directory-submissions',{method:'POST',body:JSON.stringify({action:'review',id:original.id,decision:'approve',officiallyVerified:true,...payload})}));
 let response=await call({listingKind:'firm',listingState:'CA',firmBiography:'About our firm.\n\nOur experience.'});assert.equal(response.status,200);const result=await response.json();assert.equal(result.published,true);assert.equal(result.approvalEmailStatus,'accepted');assert.deepEqual(approvalEmails,[original.id]);
 const firm=batch.find(s=>s.sql.startsWith('INSERT INTO firm_settings'));assert.ok(firm);assert.equal(firm.values[3],null);assert.equal(firm.values[5],details.phone);assert.equal(firm.values[8],'CA');assert.equal(firm.values[10],'existing-logo.png');
 const update=batch.find(s=>s.sql.startsWith('UPDATE directory_submissions'));assert.equal(update.values[0],'CA');assert.equal(JSON.parse(update.values[1]).photoKey,'existing-logo.png');assert.equal(JSON.parse(update.values[1]).biography,'About our firm.\n\nOur experience.');assert.match(update.sql,/kind='firm'/);
 batch.length=0;response=await call({listingKind:'lawyer',listingState:'GA'});assert.equal(response.status,400);assert.equal(batch.length,0,'Individual lawyers still require membership verification');
 admin=false;response=await call({listingKind:'firm',listingState:'CA'});assert.equal(response.status,403);assert.equal(batch.length,0);
});
