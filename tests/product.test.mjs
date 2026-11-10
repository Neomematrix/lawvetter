import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as nodeCrypto from 'node:crypto';
import * as React from 'react';
const {webcrypto}=nodeCrypto;
test('Firm biography details apply only to the matching Florida attorney',async()=>{
 const x=await runtime(),{publishedAttorneyDetails}=await x.load('app/published-attorney-details.ts');
 const record={bar_number:'1017061',name:'Helbert Lopez',state:'FL'};
 const details=publishedAttorneyDetails(record);
 assert.equal(details.phone,'1 (800) 990-7763');assert.equal(details.email,'info@FloridaLegalAdvice.com');
 assert.equal(details.education.length,3);assert.equal(details.admissions.length,2);assert.equal(details.affiliations.length,2);
 assert.equal(publishedAttorneyDetails({...record,state:'GA'}),null);
 assert.equal(publishedAttorneyDetails({...record,name:'Another Attorney'}),null);
 assert.equal(publishedAttorneyDetails({...record,bar_number:'1017062'}),null);
});
const root=path.resolve('.');
const adminTestToken='ab'.repeat(32),adminTestCookie='__Host-lawvetter-admin='+adminTestToken;
test('Florida bulk imports require official matching eligibility and preserve Georgia records and owned profile data',async()=>{
 const x=await runtime();x.env.ATTORNEY_IMPORT_KEY='test-key';x.seed('37329','Georgia Same Number');
 const api=await x.load('app/api/admin/import/route.ts');const row={barNumber:'37329',id:'FL:37329',name:'Florida Test Attorney',company:'Example Florida Firm',city:'Miami',state:'FL',county:'',status:'Active Member in Good Standing',admitDate:'',lawSchool:'',address:'123 Example Street',zip:'33131',phone:'305-555-0100',email:'fl@example.test',sourceUrl:'https://www.floridabar.org/directories/find-mbr/profile/?num=37329',importedAt:'2026-10-12',eligibility:'Eligible to Practice Law in Florida',membershipStatus:'Member in Good Standing'};
 const req=rows=>new Request('https://lawvetter.test/api/admin/import',{method:'POST',headers:{Authorization:'Bearer test-key','Content-Type':'application/json'},body:JSON.stringify(rows)});
 assert.equal((await api.POST(req([{...row,eligibility:'Not eligible'}]))).status,400);assert.equal((await api.POST(req([{...row,sourceUrl:row.sourceUrl+'1'}]))).status,400);
 assert.equal((await api.POST(req([row]))).status,200);x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES(?,?,?,?,?)').run('FL:37329','owner','2026-10-12','2026-10-12','Preserved');x.sql.prepare("UPDATE attorneys SET law_school='Known School',admit_date='2020-01-01' WHERE bar_number='FL:37329'").run();
 assert.equal((await api.POST(req([row]))).status,200);assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('37329').name,'Georgia Same Number');assert.equal(x.sql.prepare('SELECT law_school FROM attorneys WHERE bar_number=?').get('FL:37329').law_school,'Known School');assert.equal(x.sql.prepare('SELECT bio FROM attorney_profiles WHERE bar_number=?').get('FL:37329').bio,'Preserved');
 const inventory=await(await api.GET(new Request('https://lawvetter.test/api/admin/import?state=FL',{headers:{Authorization:'Bearer test-key'}}))).json();assert.deepEqual(inventory.bars,['37329']);
});
test('A new Georgia license can coexist with a legacy Florida ID, and Georgia imports cannot overwrite Florida',async()=>{
 const x=await runtime();x.seed('600150','Legacy Florida Attorney');x.sql.prepare("UPDATE attorneys SET state='FL' WHERE bar_number='600150'").run();
 const api=await x.load('app/api/directory-submissions/route.ts');const draft={action:'submit',kind:'lawyer',practiceAreas:'Family law',state:'GA',barNumber:'600150',name:'New Georgia Attorney',firmName:'Georgia Firm',city:'Atlanta',officialSourceUrl:'https://example.test/official',submitterName:'Submitter',submitterEmail:'submitter@example.test'};
 const {id}=await(await api.POST(request(draft,''))).json();assert.equal((await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 assert.equal(x.sql.prepare('SELECT state FROM attorneys WHERE bar_number=?').get('GA:600150').state,'GA');assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('600150').name,'Legacy Florida Attorney');
 x.env.ATTORNEY_IMPORT_KEY='test-key';const importer=await x.load('app/api/admin/import/route.ts');const row={barNumber:'600150',id:'AB123',name:'Updated Georgia Attorney',company:'Georgia Firm',city:'Atlanta',state:'GA',county:'Fulton',status:'Active Member in Good Standing',admitDate:'2020-01-01',lawSchool:'Example Law School',address:'',zip:'',phone:'',email:'',sourceUrl:'https://www.gabar.org/member-directory/?id=AB123',importedAt:'2026-10-12'};
 const imported=await importer.POST(new Request('https://lawvetter.test/api/admin/import',{method:'POST',headers:{Authorization:'Bearer test-key','Content-Type':'application/json'},body:JSON.stringify([row])}));assert.equal(imported.status,200);assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('600150').name,'Legacy Florida Attorney');assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('GA:600150').name,row.name);
 assert.throws(()=>x.sql.prepare('INSERT INTO attorneys(bar_number,license_number,source_id,name,state,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run('FL:600150','600150','another','Duplicate','FL','Active Member in Good Standing','https://example.test','2026-10-12'));
});
test('City suggestions narrow by state and prefix, while accepting cities beyond the suggestions',async()=>{
 const x=await runtime();x.seed('100001','Georgia Attorney');x.seed('100002','Florida Attorney');x.sql.prepare("UPDATE attorneys SET state='FL',city='Tampa Bay' WHERE bar_number='100002'").run();
 const api=await x.load('app/api/cities/route.ts');const fl=await(await api.GET(new Request('https://lawvetter.test/api/cities?state=FL&q=Tam'))).json();assert.ok(fl.cities.includes('Tampa'));assert.ok(!fl.cities.includes('Tampa Bay'));assert.ok(!fl.cities.includes('Atlanta'));
 const ga=await(await api.GET(new Request('https://lawvetter.test/api/cities?state=GA&q=Atl'))).json();assert.deepEqual(ga.cities,['Atlanta']);
 for(const [state,q,city] of [['TX','Hou','Houston'],['NY','New Y','New York'],['CA','San Fra','San Francisco'],['WA','Seat','Seattle']]){
  const found=await(await api.GET(new Request('https://lawvetter.test/api/cities?'+new URLSearchParams({state,q})))).json();assert.ok(found.cities.includes(city));assert.ok(!found.cities.includes('Atlanta'));
 }
 x.env.DB={prepare(){throw Error('Directory unavailable');}};
 const fallback=await api.GET(new Request('https://lawvetter.test/api/cities?state=TX&q=Hou'));assert.equal(fallback.status,200);assert.ok((await fallback.json()).cities.includes('Houston'));

});
test('Combined public attorney, firm and photo submissions stay private until approval and join one firm group',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts'),search=await x.load('app/api/attorneys/route.ts'),photos=await x.load('app/api/profile-photo/route.ts');
 const draft={action:'submit',kind:'lawyer',practiceAreas:'Family law',state:'FL',barNumber:'900001',name:'New Florida Attorney',firmName:'New Firm, P.A.',firmWebsite:'https://new-firm.example.test/',city:'Tampa',officialSourceUrl:'https://example.test/record',submitterName:'Submitter',submitterEmail:'submitter@example.test'};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg==','base64');
 const multipart=(data,file)=>{const form=new FormData();form.set('data',JSON.stringify(data));form.set('photo',new File([file],'portrait.png',{type:'image/png'}));return new Request('https://lawvetter.test/api/directory-submissions',{method:'POST',headers:{Origin:'https://lawvetter.test'},body:form});};
 assert.equal((await api.POST(multipart(draft,Buffer.from('not an image')))).status,400);assert.equal(x.sql.prepare('SELECT count(*) n FROM directory_submissions').get().n,0);
 const submitted=await api.POST(multipart(draft,png));assert.equal(submitted.status,200);const {id}=await submitted.json();assert.equal(x.files.size,1);assert.equal((await photos.GET(new Request('https://lawvetter.test/api/profile-photo?submission='+id))).status,404);
 assert.equal((await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Firm%20PA'))).status,404);
 assert.equal((await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 const firm=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Firm%20PA'))).json();assert.equal(firm.firm.total,1);assert.equal(firm.firm.website,draft.firmWebsite);assert.equal(internalBar(x,firm.attorneys[0].bar_number),'FL:900001');
 assert.equal((await photos.GET(new Request('https://lawvetter.test/api/profile-photo?bar=FL:900001'))).status,200);
 const second=await(await api.POST(request({...draft,officialSourceUrl:'https://example.test/record/900002',barNumber:'900002',name:'Second Florida Attorney',firmName:'New Firm PA',firmWebsite:''},''))).json();assert.ok(second.id);assert.equal((await api.POST(request({action:'review',id:second.id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 const grouped=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Firm%20PA'))).json();assert.equal(grouped.firm.total,2);assert.equal(grouped.firm.website,draft.firmWebsite);assert.ok(grouped.attorneys.every(a=>a.company==='New Firm, P.A.'));
});
test('Georgia and Florida licenses with the same number publish separately without moving existing profile ownership',async()=>{
 const x=await runtime();x.seed('500150','Existing Georgia Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES(?,?,?,?,?)').run('500150','original-owner','2026-10-01','2026-10-01','Preserved biography');
 const api=await x.load('app/api/directory-submissions/route.ts'),search=await x.load('app/api/attorneys/route.ts'),profiles=await x.load('app/api/profiles/route.ts'),reviews=await x.load('app/api/client-reviews/route.ts');
 const draft={action:'submit',kind:'lawyer',practiceAreas:'Family law',state:'FL',barNumber:'500150',name:'Florida Attorney',firmName:'Florida Firm',city:'Tampa',officialSourceUrl:'https://example.test/official',submitterName:'Submitter',submitterEmail:'submitter@example.test'};
 const {id}=await(await api.POST(request(draft,''))).json();assert.ok(id);const approve=await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'));assert.equal(approve.status,200);
 const ga=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('500150'),fl=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('FL:500150');assert.equal(ga.name,'Existing Georgia Attorney');assert.equal(ga.state,'GA');assert.equal(fl.state,'FL');assert.equal(fl.license_number,'500150');
 assert.equal(x.sql.prepare('SELECT bio FROM attorney_profiles WHERE bar_number=?').get('500150').bio,'Preserved biography');assert.equal(x.sql.prepare('SELECT owner_id FROM attorney_profiles WHERE bar_number=?').get('500150').owner_id,'original-owner');
 const matches=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?q=500150'))).json();assert.equal(matches.total,2);const qualified=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?q=FL%3A500150'))).json();assert.equal(qualified.total,1);assert.equal(qualified.attorneys[0].name,'Florida Attorney');
 assert.equal((await reviews.GET(new Request('https://lawvetter.test/api/client-reviews?bar=FL:500150'))).status,200);
 assert.equal((await profiles.POST(request({action:'claim',bar:'FL:500150',fullName:'Florida Attorney',verification:'Official firm profile and independent identification.',attestation:true},'fl-owner','fl-owner@example.test'))).status,200);
 assert.throws(()=>x.sql.prepare('INSERT INTO attorneys(bar_number,license_number,source_id,name,state,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run('another-id','500150','another','Duplicate','FL','Active Member in Good Standing','https://example.test','2026-10-12'));
});
function database(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));const db={prepare(text){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){const x=sql.prepare(text).run(...args);return {meta:{changes:Number(x.changes)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {sql,db};}
async function runtime(options={}){const {sql,db}=database(),files=new Map(),background=[];sql.exec('INSERT INTO search_index_progress(id,ready) VALUES(1,1)');sql.prepare('INSERT INTO admin_credentials(email,password_hash,updated_at) VALUES(?,?,?)').run('admin@example.test','fixture-only','2026-01-01');sql.prepare('INSERT INTO admin_sessions(token_hash,email,expires_at,last_seen) VALUES(?,?,?,?)').run(nodeCrypto.createHash('sha256').update(adminTestToken).digest('hex'),'admin@example.test',Date.now()+3600000,Date.now());const env={DB:db,CLAIM_ADMIN_EMAIL:'admin@example.test',PROFILE_PHOTOS:{async head(key){return files.get(key)||null;},async put(key,buffer,metadata){const old=files.get(key),condition=metadata?.onlyIf;if(condition?.etagMatches&&old?.etag!==condition.etagMatches)return null;if(condition?.etagDoesNotMatch==='*'&&old)return null;const saved={body:buffer,...metadata,etag:nodeCrypto.randomUUID()};files.set(key,saved);return saved;},async get(key){const saved=files.get(key);return saved?{...saved,json:async()=>JSON.parse(saved.body)}:null;},async delete(key){files.delete(key)}}};let clockOffset=0;class Clock extends Date{static now(){return Date.now()+clockOffset;}}const context=vm.createContext({structuredClone,setTimeout,clearTimeout,console,Request,Response,URL,File,FormData,Uint8Array,Buffer,Date:Clock,Intl,TextEncoder,TextDecoder,btoa,atob,crypto:webcrypto,AbortSignal,fetch:options.fetch});const cache=new Map();async function module(file){if(cache.has(file))return cache.get(file);if(file.endsWith('.json.ts')){const m=new vm.SyntheticModule(['default'],function(){this.setExport('default',JSON.parse(fs.readFileSync(file.slice(0,-3),'utf8')))},{context});cache.set(file,m);return m;}if(file==='react'){const m=new vm.SyntheticModule(Object.keys(React),function(){for(const [k,v] of Object.entries(React))this.setExport(k,v)},{context});cache.set(file,m);return m;}if(file==='node:crypto'){const m=new vm.SyntheticModule(Object.keys(nodeCrypto),function(){for(const [k,v] of Object.entries(nodeCrypto))this.setExport(k,v)},{context});cache.set(file,m);return m;}if(file==='cloudflare:workers'){const m=new vm.SyntheticModule(['env','waitUntil'],function(){this.setExport('env',env);this.setExport('waitUntil',work=>background.push(work))},{context});cache.set(file,m);return m;}const text=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const m=new vm.SourceTextModule(text,{context,identifier:file});cache.set(file,m);return m;}async function load(file){const m=await module(path.join(root,file));if(m.status==='unlinked')await m.link(async(spec,parent)=>module((spec==='cloudflare:workers'||spec==='node:crypto'||spec==='react')?spec:path.resolve(path.dirname(parent.identifier),spec)+'.ts'));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}function seed(bar,name,company='Example Legal LLC',status='Active Member in Good Standing'){sql.prepare('INSERT INTO attorneys(bar_number,source_id,name,company,city,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run(bar,bar,name,company,'Atlanta',status,'https://example.test/record','2026-10-08T00:00:00Z');}return {sql,db,load,seed,files,env,flushBackground:async()=>{while(background.length)await Promise.all(background.splice(0));},advance:ms=>{clockOffset+=ms;}};}
function request(data,user='attorney-a',email='a@example.test'){if(data.action==='claim'&&data.firmEmail===undefined)data={...data,firmEmail:'attorney@verified-firm.example.test'};const headers={'Content-Type':'application/json',Origin:'https://lawvetter.test'};if(user&&email==='admin@example.test')headers.Cookie=adminTestCookie;if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=email;}return new Request('https://lawvetter.test/api/profiles',{method:'POST',headers,body:JSON.stringify(data)});}
test('Directory initials find full middle names without breaking word boundaries or practice filters',async()=>{
 const x=await runtime();x.seed('004170','Randall Mark Kessler','Kessler & Solomiany LLC');x.seed('100001','Randall Michael Other');x.seed('100002','United Smith');
 const api=await x.load('app/api/attorneys/route.ts');
 for(const q of ['Randall M. Kessler','Randall Kessler','Randy Kessler','R. M. Kessler','004170']){
  const r=await(await api.POST(request({q,statusGroup:'active'}))).json();assert.equal(r.total,1,q);assert.equal(internalBar(x,r.attorneys[0].bar_number),'004170',q);
 }
 assert.equal((await(await api.POST(request({q:'Ted'}))).json()).total,0);
 const family=await(await api.POST(request({q:'Randall M. Kessler',practice:'family-law',statusGroup:'active'}))).json();assert.equal(internalBar(x,family.attorneys[0].bar_number),'004170');
 const firms=await x.load('app/firm-websites.ts');const keys=await x.load('app/api/attorneys/firm.ts');
 assert.equal(firms.websitesByFirm[keys.firmKey('Smith, Gambrell & Russell LLP')],'https://www.sgrlaw.com/');
 assert.equal(firms.websitesByFirm[keys.firmKey('Kessler &  Solomiany, LLC')],'https://www.ksfamilylaw.com/');
 assert.equal(firms.attorneyLinkedIn['004170'],'https://www.linkedin.com/in/randallkessler/');
 for(const url of [...Object.values(firms.websitesByFirm),...Object.values(firms.linkedInByFirm),...Object.values(firms.attorneyLinkedIn)]){const parsed=new URL(url);assert.equal(parsed.protocol,'https:');assert.equal(parsed.username,'');assert.equal(parsed.password,'');}
});
test('Directory reconciliation requires its secret and preserves claimed profiles and search history',async()=>{
 const x=await runtime();x.seed('004170','Old Name','Old Company');x.env.ATTORNEY_IMPORT_KEY='test-import-key';
 x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run('004170','owner','2026-10-08','2026-10-08');
 x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('old-event','004170',new Date().toISOString());
 const api=await x.load('app/api/admin/import/route.ts');assert.equal((await api.GET(request({}))).status,401);assert.equal((await api.POST(request([]))).status,401);
 const row={barNumber:'004170',id:'ABC123',name:'Randall Mark Kessler',company:'Kessler & Solomiany LLC',city:'Atlanta',state:'GA',county:'Fulton',status:'Active Member in Good Standing',admitDate:'1988-06-06',lawSchool:'Emory University',address:'',zip:'',phone:'',email:'',sourceUrl:'https://www.gabar.org/member-directory/?id=ABC123',importedAt:'2026-10-09'};
 const req=()=>new Request('https://lawvetter.test/api/admin/import',{method:'POST',headers:{Authorization:'Bearer test-import-key','Content-Type':'application/json'},body:JSON.stringify([row])});
 assert.equal((await api.POST(req())).status,200);assert.equal((await api.POST(req())).status,200);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,1);assert.equal(x.sql.prepare('SELECT name FROM attorneys').get().name,row.name);
 assert.equal(x.sql.prepare('SELECT owner_id FROM attorney_profiles').get().owner_id,'owner');assert.equal(x.sql.prepare('SELECT count(*) n FROM attorney_search_events').get().n,1);
 assert.equal((await(await api.GET(req())).json()).bars[0],'004170');
});
test('Claim approval, ownership isolation, durable profile edits and private shortlists',async()=>{const x=await runtime();x.seed('100001','Fictional Attorney A');x.seed('100002','Fictional Attorney B');const profiles=await x.load('app/api/profiles/route.ts');
 assert.equal((await profiles.POST(request({action:'claim'},''))).status,401);
 assert.equal((await profiles.POST(request({action:'claim',bar:'100001',fullName:'Fictional Attorney A',verification:'Official firm profile is available for independent verification.',attestation:true}))).status,200);
 let state=await (await profiles.POST(request({action:'view',bar:'100001'}))).json();assert.equal(state.profile,null);assert.equal(state.claim.status,'pending');
 const id=JSON.stringify(['attorney-a','100001']);
 assert.equal((await profiles.POST(request({action:'review',id,decision:'approve',verified:true},'attorney-b','b@example.test'))).status,403);
 assert.equal((await profiles.POST(request({action:'review',id,decision:'approve'},'site-owner','admin@example.test'))).status,400);
 x.sql.prepare('UPDATE profile_claims SET firm_email_verified_at=? WHERE id=?').run('2026-10-13',id);assert.equal((await profiles.POST(request({action:'review',id,decision:'approve',verified:true},'site-owner','admin@example.test'))).status,200);
 state=await (await profiles.POST(request({action:'view',bar:'100001'}))).json();assert.ok(state.profile);assert.equal(state.isOwner,true);
 const edit={action:'save',bar:'100001',headline:'Fictional headline',bio:'Saved bio',practiceAreas:'Mediation',website:'https://example.test'};
 assert.equal((await profiles.POST(request(edit,'attorney-b','b@example.test'))).status,403);assert.equal((await profiles.POST(request(edit))).status,200);
 assert.equal((await (await profiles.POST(request({action:'view',bar:'100001'}))).json()).profile.bio,'Saved bio');
 assert.equal((await profiles.POST(request({...edit,website:'javascript:alert(1)'}))).status,400);
 const shortlist=await x.load('app/api/shortlist/route.ts'),auth=await x.load('app/api/client-auth/route.ts');
 // Platform sign-in does not establish a LawVetter client session.
 const guestShortlist=await shortlist.POST(request({action:'list'}));assert.equal(guestShortlist.status,200);assert.deepEqual(await guestShortlist.json(),{signedIn:false,attorneys:[]});
 async function clientCookie(email){const r=await auth.POST(request({action:'register',firstName:'Test',lastName:'Client',email,password:'test account password',consent:true},''));assert.equal(r.status,201);return r.headers.get('set-cookie').split(';')[0];}
 const clientA=await clientCookie('client-a@example.test'),clientB=await clientCookie('client-b@example.test');
 const clientRequest=(action,cookie=clientA)=>new Request('https://lawvetter.test/api/shortlist',{method:'POST',headers:{Cookie:cookie,Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify({action,bar:'100001'})});
 assert.equal((await shortlist.POST(clientRequest('save'))).status,200);
 assert.equal((await shortlist.POST(clientRequest('save'))).status,200);
 assert.equal((await(await shortlist.POST(clientRequest('list'))).json()).attorneys.length,1);
 assert.equal((await(await shortlist.POST(clientRequest('list',clientB))).json()).attorneys.length,0);
 assert.equal((await shortlist.POST(clientRequest('remove',clientB))).status,200);
 assert.equal((await(await shortlist.POST(clientRequest('list'))).json()).attorneys.length,1);
 assert.equal((await shortlist.POST(clientRequest('remove'))).status,200);
 assert.equal((await(await shortlist.POST(clientRequest('list'))).json()).attorneys.length,0);
 assert.equal(x.sql.prepare('SELECT count(*) AS n FROM attorneys').get().n,2);
 const photos=await x.load('app/api/profile-photo/route.ts');const form=new FormData();form.set('bar','100001');form.set('photo',new File([fs.readFileSync('public/claimed-badge.png')],'test.png',{type:'image/png'}));
 const photoReq=(user)=>new Request('https://lawvetter.test/api/profile-photo',{method:'POST',headers:{'oai-authenticated-user-id':user,Origin:'https://lawvetter.test'},body:form});
 assert.equal((await photos.POST(photoReq('attorney-b'))).status,403);assert.equal((await photos.POST(photoReq('attorney-a'))).status,200);
 const downloaded=await photos.GET(new Request('https://lawvetter.test/api/profile-photo?bar=100001'));assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('Content-Type'),'image/png');assert.ok((await downloaded.arrayBuffer()).byteLength>0);
 const account=await(await profiles.POST(request({action:'account'},'attorney-b','b@example.test'))).json();assert.equal(account.profiles.length,0);assert.equal(account.claims.length,0);
});
test('Charts use real, deduplicated recent searches, order ties alphabetically with consecutive ranks, and group firm variants',async()=>{const x=await runtime();x.seed('100001','Fictional Attorney A','Example Legal, LLC.');x.seed('100002','Fictional Attorney B','Example Legal LLC');x.seed('100003','Fictional Inactive','Other Legal LLC','Inactive Member in Good Standing');const charts=await x.load('app/api/attorneys/charts.ts');assert.equal(charts.monthStart(new Date('2026-10-08T20:00:00Z')),'2026-10-01T04:00:00.000Z');assert.equal(charts.monthStart(new Date('2027-01-08T20:00:00Z')),'2027-01-01T05:00:00.000Z');
 for(const [id,bar,date] of [['one','100001','2026-10-08T12:00:00Z'],['two','100002','2026-10-08T12:00:00Z'],['old','100001','2026-09-01T12:00:00Z'],['inactive','100003','2026-10-08T12:00:00Z']])x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run(id,bar,date);
 x.sql.prepare('INSERT INTO firm_search_events VALUES(?,?,?,?)').run('one','examplelegalllc','Example Legal LLC','2026-10-08T12:00:00Z');
 const bounds=['2026-10-01T12:00:00Z','2026-10-08T20:00:00Z'];const attorneys=x.sql.prepare(charts.attorneyChartSQL).all(...bounds);assert.equal(attorneys.length,2);assert.equal(attorneys[0].rank,1);assert.equal(attorneys[1].rank,2);assert.equal(attorneys[0].name,'Fictional Attorney A');assert.equal(attorneys[1].name,'Fictional Attorney B');assert.equal(attorneys[0].searches,1);
 const firms=x.sql.prepare(charts.firmChartSQL).all(...bounds,...bounds);assert.equal(firms[0].firm_key,'examplelegalllc');assert.equal(firms[0].searches,2);
 const api=await x.load('app/api/attorneys/route.ts');const firm=await(await api.POST(request({kind:'firms',q:'Example Legal'}))).json();assert.equal(firm.total,1);assert.equal(firm.firms[0].attorneys,2);
 const profile=await(await api.POST(request({firm:'Example Legal, L.L.C.'}))).json();assert.equal(profile.firm.total,2);
 const active=await(await api.POST(request({q:'Fictional',statusGroup:'active'}))).json();const inactive=await(await api.POST(request({q:'Fictional',statusGroup:'not-active'}))).json();assert.equal(active.total,2);assert.equal(inactive.total,0);
});
test('Practice browsing combines sourced classifications and exact owner-provided areas without inventing coverage',async()=>{const x=await runtime();x.seed('231458','Source Classified Attorney');x.seed('100001','Owner Classified Attorney');x.seed('100002','Unrelated Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,claimed_at,updated_at) VALUES(?,?,?,?,?)').run('100001','owner','Family law, Employment law','2026-10-08','2026-10-08');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,claimed_at,updated_at) VALUES(?,?,?,?,?)').run('100002','other','Non-family law related consulting','2026-10-08','2026-10-08');const api=await x.load('app/api/attorneys/route.ts');const results=await(await api.POST(request({practice:'family-law',statusGroup:'active'}))).json();assert.equal(results.total,2);assert.deepEqual(results.attorneys.map(a=>internalBar(x,a.bar_number)).sort(),['100001','231458']);assert.equal((await api.POST(request({practice:'made-up'}))).status,400);const narrowed=await(await api.POST(request({practice:'family-law',q:'Owner'}))).json();assert.equal(narrowed.total,1);assert.equal(internalBar(x,narrowed.attorneys[0].bar_number),'100001');});
test('Client requests persist once, require consent, and remain owner-only',async()=>{const x=await runtime(),api=await x.load('app/api/leads/route.ts');const data={id:'12345678-1234-4123-8123-123456789012',name:'Test Client',email:'client@example.test',phone:'',city:'Atlanta, GA',practice:'family-law',summary:'I need help with a family law matter.',contactMethod:'email',consent:true};assert.equal((await api.POST(request({...data,consent:false},''))).status,400);assert.equal((await api.POST(request(data,''))).status,201);assert.equal((await api.POST(request(data,''))).status,200);assert.equal(x.sql.prepare('SELECT count(*) AS n FROM client_leads').get().n,1);assert.equal((await api.GET(request({},''))).status,403);assert.equal((await api.GET(request({},'other','other@example.test'))).status,403);const result=await(await api.GET(request({},'admin','admin@example.test'))).json();assert.equal(result.leads[0].email,data.email);assert.equal((await api.POST(request({action:'status',id:data.id,status:'contacted'},'other'))).status,403);assert.equal((await api.POST(request({action:'status',id:data.id,status:'contacted'},'admin','admin@example.test'))).status,200);assert.equal(x.sql.prepare('SELECT status FROM client_leads').get().status,'contacted');const cross=new Request('https://lawvetter.test/api/leads',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal((await api.POST(cross)).status,403);});
test('Expanded practice results paginate all matched records without a bind-per-attorney limit',async()=>{const x=await runtime(),{practiceSources,practiceAreas}=await x.load('app/practice-areas.ts');for(const bar of Object.keys(practiceSources))x.seed(bar,'Attorney '+bar);const api=await x.load('app/api/attorneys/route.ts');for(const area of practiceAreas){const expected=Object.entries(practiceSources).filter(([,s])=>s.areas.includes(area.id)).map(([bar])=>bar).sort();const found=[];for(let page=1;page<=Math.ceil(expected.length/24);page++){const result=await(await api.POST(request({practice:area.id,statusGroup:'active',page}))).json();assert.equal(result.total,expected.length);found.push(...result.attorneys.map(a=>internalBar(x,a.bar_number)));}assert.deepEqual(found.sort(),expected);}assert.ok(Object.values(practiceSources).filter(s=>s.areas.includes('family-law')).length>25);});
test('Exact search totals stay out of visitor data and owner analytics reject other users',async()=>{const x=await runtime();x.seed('100001','Test Attorney');x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('event','100001',new Date().toISOString());const charts=await x.load('app/api/attorneys/charts.ts');const visible=await charts.discoveryData(x.db);assert.equal(visible.weekly.length,1);assert.equal('searches' in visible.weekly[0],false);const api=await x.load('app/api/admin/searches/route.ts');assert.equal((await api.GET(request({},'other','other@example.test'))).status,403);const owner=await(await api.GET(request({},'admin','admin@example.test'))).json();assert.equal(owner.weekly[0].searches,1);});
test('Firm roster sorts by current monthly search rank before name',async()=>{const x=await runtime();x.seed('100001','Aaron First');x.seed('100002','Zoe Popular');const now=new Date().toISOString();x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('one','100002',now);const api=await x.load('app/api/attorneys/route.ts');const results=await(await api.POST(request({firm:'Example Legal LLC'}))).json();assert.deepEqual(results.attorneys.map(a=>internalBar(x,a.bar_number)),['100002','100001']);assert.equal('searches' in results.attorneys[0],false);});
test('Attorney analytics require sign-in and approved ownership, and never expose another profile',async()=>{const x=await runtime();x.seed('100001','Attorney One');x.seed('100002','Attorney Two');for(const [bar,owner] of [['100001','one'],['100002','two']])x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run(bar,owner,'2026-10-08','2026-10-08');const api=await x.load('app/api/account/analytics/route.ts');assert.equal((await api.GET(request({},''))).status,401);assert.equal((await api.GET(request({},'unapproved'))).status,403);const result=await(await api.GET(request({},'one'))).json();assert.equal(result.profiles.length,1);assert.equal(result.profiles[0].bar_number,'100001');});

test('Client passwords, persistent sessions, ownership, review approval and logout',async()=>{
 const x=await runtime();x.seed('100001','Fictional Attorney');
 const auth=await x.load('app/api/client-auth/route.ts'),reviews=await x.load('app/api/client-reviews/route.ts');
 const password='fictional test password only';
 const account={action:'register',firstName:'Test',lastName:'Client',email:'test@example.test',password,consent:true};
 const req=(data,cookie='',user='',email='')=>new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json',Cookie:email==='admin@example.test'?adminTestCookie:cookie,'oai-authenticated-user-id':user,'oai-authenticated-user-email':email},body:JSON.stringify(data)});
 const cookie=r=>r.headers.get('set-cookie').split(';')[0];
 const tooShort=await auth.POST(req({...account,password:'12345678'}));assert.equal(tooShort.status,400);assert.equal((await tooShort.json()).error,'Password must be at least 9 characters.');
 const registered=await auth.POST(req(account));assert.equal(registered.status,201);let session=cookie(registered);assert.match(registered.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 const user=x.sql.prepare('SELECT user_id FROM client_profiles WHERE email=?').get(account.email).user_id;
 const stored=x.sql.prepare('SELECT password_hash FROM client_passwords').get().password_hash;assert.ok(!stored.includes(password));assert.match(stored,/^scrypt\$/);
 assert.equal((await auth.POST(req(account))).status,409);
 const status=await(await auth.GET(req({},session))).json();assert.equal(status.client.email,account.email);
 assert.equal((await auth.POST(req({action:'login',email:account.email,password:'incorrect password'}))).status,401);
 const login=await auth.POST(req({action:'login',email:' TEST@EXAMPLE.TEST ',password}));assert.equal(login.status,200);const otherSession=cookie(login);
 const submitted={action:'request',bar:'100001',legalName:'Test Client',state:'GA',county:'Fictional County',court:'Fictional Superior Court',partyRole:'plaintiff',docket:'PRIVATE-CASE-42',attestation:true};
 assert.equal((await reviews.POST(req(submitted))).status,401);
 assert.equal((await reviews.POST(req(submitted,session))).status,200);
 const id=JSON.stringify([user,'100001']);const review={action:'publish',id,body:'My attorney explained the process clearly and answered my questions.',mode:'anonymous',consent:true,rating_use_again:5,rating_cared_for:4,rating_rights:3,rating_outcome:2};
 assert.equal((await reviews.POST(req(review,session))).status,403);
 assert.equal((await reviews.POST(req({action:'admin-list'},session))).status,403);
 const approve={action:'decide',id,decision:'approve',court:'Fictional Superior Court',county:'Fictional County',note:'Verified through independent evidence.',source:'https://researchga.tylerhost.net/CourtRecordsSearch/case/test-fixture',identityEvidence:'Independent identity evidence recorded for this test client.',representationEvidence:'Court appearance record identifies this client and this attorney.',identityChecked:true,recordChecked:true,relationshipChecked:true};
 assert.equal((await reviews.POST(req(approve,session))).status,403);
 assert.equal((await reviews.POST(req({...approve,identityChecked:false},'','owner','admin@example.test'))).status,400);
 assert.equal((await reviews.POST(req({...approve,court:''},'','owner','admin@example.test'))).status,400);
 assert.equal((await reviews.POST(req(approve,'','owner','admin@example.test'))).status,200);
 assert.equal((await reviews.POST(req({...review,consent:false},session))).status,400);
 for(const invalid of [0,6,1.5,'5',null])assert.equal((await reviews.POST(req({...review,rating_use_again:invalid},session))).status,400);
 assert.equal(x.sql.prepare('SELECT published_at FROM client_verifications WHERE id=?').get(id).published_at,null);
 for(const body of ['123456789',' '.repeat(12),'x'.repeat(2001)])assert.equal((await reviews.POST(req({...review,body},session))).status,400);
 async function approveReview(){const pending=x.sql.prepare('SELECT review_revision,review_status FROM client_verifications WHERE id=?').get(id);if(pending.review_status!=='pending')return;assert.equal((await reviews.POST(req({action:'review-decide',id,revision:pending.review_revision,decision:'approve'},'','owner','admin@example.test'))).status,200);}
 for(const body of ['1234567890','Great lawyer.','x'.repeat(2000)]){assert.equal((await reviews.POST(req({...review,body},session))).status,200);await approveReview();}
 assert.equal((await reviews.POST(req(review,session))).status,200);await approveReview();
 const publicReviews=()=>reviews.GET(new Request('https://lawvetter.test/api/client-reviews?bar=100001')).then(r=>r.json());
 let publicData=await publicReviews();assert.equal(publicData.reviews[0].author,'Anonymous');assert.equal(publicData.reviews[0].anonymous,1);for(const key of ['rating_use_again','rating_cared_for','rating_rights','rating_outcome'])assert.equal(publicData.reviews[0][key],review[key]);for(const secret of [account.email,'PRIVATE-CASE-42','identity_evidence',user])assert.ok(!JSON.stringify(publicData).includes(secret));
 assert.equal((await reviews.POST(req({...review,mode:'named'},session))).status,200);assert.equal((await publicReviews()).reviews[0].author,'Anonymous');await approveReview();assert.equal((await publicReviews()).reviews[0].author,'Test C.');
 const b=await auth.POST(req({...account,email:'second@example.test',firstName:'Second',password:'123456789'}));assert.equal(b.status,201);const bCookie=cookie(b);
 assert.equal((await reviews.POST(req(review,bCookie))).status,403);assert.equal((await(await reviews.POST(req({action:'account'},bCookie))).json()).requests.length,0);
 x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,photo_key) VALUES('100001','','','now','attorneys/100001/dashboard-photo.jpg') ON CONFLICT(bar_number) DO UPDATE SET photo_key=excluded.photo_key").run();
 const own=await(await reviews.POST(req({action:'account'},session))).json();assert.equal(JSON.parse(own.requests[0].id)[0],JSON.parse(id)[0]);assert.equal(internalBar(x,JSON.parse(own.requests[0].id)[1]),'100001');assert.equal(own.requests[0].attorney_photo_key,(await x.load('app/attorney-photo.ts')).photoRevision('attorneys/100001/dashboard-photo.jpg'));assert.equal(own.requests[0].rating_cared_for,4);assert.ok(!JSON.stringify(own).includes('identity_evidence'));
 const change=await auth.POST(req({action:'change-password',email:account.email,password:'a completely different passphrase',currentPassword:password},session));assert.equal(change.status,200);const updatedSession=cookie(change);
 assert.equal((await auth.GET(req({},session)).then(r=>r.json())).client,null);assert.equal((await auth.GET(req({},otherSession)).then(r=>r.json())).client,null);
 assert.equal((await auth.POST(req({action:'logout'},updatedSession))).status,200);assert.equal((await reviews.POST(req({action:'account'},updatedSession))).status,401);
 // Even platform identity does not silently re-open a password session after logout.
 assert.equal((await reviews.POST(req({action:'account'},'',user,account.email))).status,401);
 assert.equal((await auth.POST(new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{Origin:'https://evil.test'},body:JSON.stringify(account)}))).status,403);
 assert.equal((await reviews.POST(req({action:'decide',id,decision:'revoke',note:'Evidence no longer supports verification.'},'','owner','admin@example.test'))).status,200);assert.equal((await publicReviews()).reviews.length,0);
});
test('Existing profiles set passwords only through their original platform identity; login throttles and expiry apply',async()=>{
 const x=await runtime(),auth=await x.load('app/api/client-auth/route.ts');
 x.sql.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES(?,?,?,?)').run('legacy','Legacy Client','legacy@example.test','2026-10-09');
 const req=(data,user='',email='',cookie='')=>new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{Origin:'https://lawvetter.test','oai-authenticated-user-id':user,'oai-authenticated-user-email':email,Cookie:cookie},body:JSON.stringify(data)});
 const data={action:'set-password',password:'legacy client passphrase'};
 assert.equal((await auth.POST(req(data))).status,401);assert.equal((await auth.POST(req(data,'wrong','legacy@example.test'))).status,403);
 const good=await auth.POST(req(data,'legacy','legacy@example.test'));assert.equal(good.status,200);const cookie=good.headers.get('set-cookie').split(';')[0];
 assert.equal((await auth.POST(req(data,'legacy','legacy@example.test'))).status,409);
 assert.equal((await auth.GET(req({},'','','forged=123')).then(r=>r.json())).client,null);
 x.sql.prepare('UPDATE client_sessions SET expires_at=0').run();assert.equal((await auth.GET(req({},'','',cookie)).then(r=>r.json())).client,null);
 let last;for(let i=0;i<11;i++)last=await auth.POST(req({action:'login',email:'legacy@example.test',password:'incorrect password'}));assert.equal(last.status,429);
 assert.equal(x.sql.prepare('SELECT count(*) AS n FROM client_profiles').get().n,1);
});

test('Password reset emails use one-time expiring tokens and revoke existing sessions',async()=>{
 const calls=[];const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return Response.json({id:'password-reset-provider-id'});}});
 x.env.RESEND_API_KEY='fictional-test-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <test@example.test>';
 const auth=await x.load('app/api/client-auth/route.ts'),email='reset-client@example.test',oldPassword='fictional old password',newPassword='fictional new password';
 const req=data=>new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify(data)});
 const registered=await auth.POST(req({action:'register',firstName:'Reset',lastName:'Client',email,password:oldPassword,consent:true}));assert.equal(registered.status,201);const oldSession=registered.headers.get('set-cookie').split(';')[0];
 const requested=await auth.POST(req({action:'request-password-reset',email}));assert.equal(requested.status,200);const requestedBody=await requested.json();
 const unknown=await auth.POST(req({action:'request-password-reset',email:'unknown@example.test'}));assert.equal(unknown.status,200);assert.equal((await unknown.json()).message,requestedBody.message);assert.equal(calls.length,1);
 const payload=JSON.parse(calls[0].init.body);assert.equal(calls[0].url,'https://api.resend.com/emails');assert.equal(payload.from,'LawVetter <no-reply@lawvetter.com>');assert.equal(payload.to[0],email);assert.equal(payload.subject,'Reset your LawVetter password');
 const profileBefore=x.sql.prepare('SELECT * FROM client_profiles').get();
 const link=payload.text.match(/https:\/\/lawvetter\.test\/reset-password\?reset=([a-f0-9]{64})/);assert.ok(link);const token=link[1];
 const stored=x.sql.prepare('SELECT token_hash,expires_at FROM client_password_reset_tokens').get();assert.notEqual(stored.token_hash,token);assert.ok(stored.expires_at>Date.now());assert.ok(stored.expires_at<=Date.now()+30*60*1000);assert.ok(!JSON.stringify(stored).includes(token));
 assert.equal((await auth.POST(req({action:'reset-password',token:'0'.repeat(64),password:newPassword}))).status,400);
 assert.equal((await auth.POST(req({action:'reset-password',token,password:'short'}))).status,400);
 assert.equal((await auth.POST(req({action:'reset-password',token,password:newPassword}))).status,200);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM client_password_reset_tokens').get().n,0);
 assert.equal((await auth.GET(new Request('https://lawvetter.test/api/client-auth',{headers:{Cookie:oldSession}})).then(r=>r.json())).client,null);
 assert.equal((await auth.POST(req({action:'reset-password',token,password:'another new password'}))).status,400);
 assert.equal((await auth.POST(req({action:'login',email,password:oldPassword}))).status,401);
 assert.equal((await auth.POST(req({action:'login',email,password:newPassword}))).status,200);assert.deepEqual(x.sql.prepare('SELECT * FROM client_profiles').get(),profileBefore);
 assert.equal((await auth.POST(req({action:'request-password-reset',email}))).status,200);
 const expiredToken=JSON.parse(calls[1].init.body).text.match(/reset=([a-f0-9]{64})/)[1];
 x.sql.prepare('UPDATE client_password_reset_tokens SET expires_at=?').run(Date.now()-1);
 assert.equal((await auth.POST(req({action:'reset-password',token:expiredToken,password:oldPassword}))).status,400);
 assert.equal((await auth.POST(req({action:'login',email,password:newPassword}))).status,200);
});

test('Approval email is private, queued without configuration, idempotent and blocked after revocation',async()=>{
 const calls=[];const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return Response.json({id:'provider-test-id'});}});x.seed('100001','Test Attorney');
 x.sql.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES(?,?,?,?)').run('client-test','Private Client','client@example.test','2026-10-09');
 x.sql.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,updated_at) VALUES('request','client-test','100001','Private Client','Court','County','SECRET-DOCKET','key','approved','now','now')").run();
 x.sql.prepare("INSERT INTO client_approval_emails(verification_id,id,recipient,status) VALUES('request','stable-key','client@example.test','pending')").run();
 const email=await x.load('db/approval-email.ts');assert.equal(await email.sendApprovalEmail('request'),'not-configured');assert.equal(calls.length,0);
 x.env.RESEND_API_KEY='fictional-test-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <test@example.test>';
 assert.equal(await email.sendApprovalEmail('request'),'accepted');assert.equal(calls.length,1);assert.equal(calls[0].init.headers['Idempotency-Key'],'stable-key');
 const payload=JSON.parse(calls[0].init.body);assert.equal(payload.to[0],'client@example.test');assert.ok(!calls[0].init.body.includes('SECRET-DOCKET'));assert.ok(payload.text.includes('/client-reviews'));
 assert.equal(await email.sendApprovalEmail('request'),'accepted');assert.equal(calls.length,1);
 x.sql.prepare("UPDATE client_approval_emails SET status='pending',first_attempt=?").run(Date.now()-24*3600000);assert.equal(await email.sendApprovalEmail('request'),'check-provider');assert.equal(calls.length,1);
 x.sql.prepare("UPDATE client_verifications SET status='revoked'").run();assert.equal(await email.sendApprovalEmail('request'),'not-queued');assert.equal(calls.length,1);
});
test('New verification requests send pertinent case details privately to the configured administrator',async()=>{
 const calls=[];const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return Response.json({id:'owner-alert-provider-id'});}});x.seed('100001','Test Attorney');
 x.env.RESEND_API_KEY='fictional-test-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <test@example.test>';
 const auth=await x.load('app/api/client-auth/route.ts'),reviews=await x.load('app/api/client-reviews/route.ts');
 const account={action:'register',firstName:'Alert',lastName:'Client',email:'alert-client@example.test',password:'fictional alert password',consent:true},docket='PRIVATE-ALERT-DOCKET';
 const req=(data,cookie='',user='',email='')=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json',Cookie:email==='admin@example.test'?adminTestCookie:cookie,'oai-authenticated-user-id':user,'oai-authenticated-user-email':email},body:JSON.stringify(data)});
 const registered=await auth.POST(req(account));const session=registered.headers.get('set-cookie').split(';')[0];
 const response=await reviews.POST(req({action:'request',bar:'100001',legalName:'Alert Client',state:'GA',county:'Cherokee',court:'Superior Court',partyRole:'plaintiff',opposingParty:'Alert Client v. Other Party',representationStart:'2025-01-01',representationEnd:'2026-01-01',requestNotes:'Check the notice of appearance.',docket,attestation:true},session));assert.equal(response.status,200);assert.equal((await response.json()).notificationEmailStatus,'accepted');
 assert.equal(calls.length,1);const payload=JSON.parse(calls[0].init.body);assert.equal(payload.to[0],'admin@example.test');assert.ok(payload.text.includes('/admin/client-reviews'));
 for(const privateValue of [account.firstName,account.lastName,account.email,docket,'Cherokee','Superior Court','2025-01-01'])assert.ok(calls[0].init.body.includes(privateValue));assert.ok(payload.html.includes('Accept request'));assert.ok(payload.html.includes('Reject request'));assert.ok(payload.html.includes('decision=approve'));assert.ok(payload.html.includes('decision=reject'));
 const queued=x.sql.prepare('SELECT id,status,recipient FROM client_verification_request_emails').get();assert.equal(queued.status,'accepted');assert.equal(queued.recipient,'admin@example.test');assert.equal(calls[0].init.headers['Idempotency-Key'],queued.id);
 assert.equal((await reviews.POST(req({action:'request',bar:'100001',legalName:'Alert Client',state:'GA',county:'Cherokee',court:'Superior Court',partyRole:'plaintiff',opposingParty:'Alert Client v. Other Party',representationStart:'2025-01-01',representationEnd:'2026-01-01',requestNotes:'Check the notice of appearance.',docket,attestation:true},session))).status,409);assert.equal(calls.length,1);
 const owner=await(await reviews.POST(req({action:'admin-list'},'','owner','admin@example.test'))).json();assert.equal(owner.requests[0].notification_email_status,'accepted');assert.equal(owner.ownerNotificationConfigured,true);
});

 test('Recovery reports missing email configuration, removes undelivered tokens, and rate limits unknown emails',async()=>{
 const calls=[];const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return Response.json({error:'rejected'},{status:403});}});
 const auth=await x.load('app/api/client-auth/route.ts');
 const req=data=>new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{Origin:'https://lawvetter.test'},body:JSON.stringify(data)});
 assert.equal((await auth.POST(req({action:'request-password-reset',email:'missing@example.test'}))).status,503);
 x.env.RESEND_API_KEY='fictional-key';
 assert.equal((await auth.POST(req({action:'register',firstName:'Delivery',lastName:'Test',email:'delivery@example.test',password:'fictional delivery password',consent:true}))).status,201);
 const failed=await auth.POST(req({action:'request-password-reset',email:'delivery@example.test'}));
 assert.equal(failed.status,200);assert.ok(!(await failed.json()).message.includes('has been sent'));
 assert.equal(calls.length,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM client_password_reset_tokens').get().n,0);
 let limited;for(let i=0;i<11;i++)limited=await auth.POST(req({action:'request-password-reset',email:'unknown@example.test'}));
 assert.equal(limited.status,429);assert.equal(calls.length,1);
 });
 test('Recovery pages retain the existing layout and expose a usable link without configuration',()=>{
 const gate=fs.readFileSync('app/client-reviews/ClientAccountGate.tsx','utf8');
 assert.ok(gate.includes('href="/forgot-password"'));assert.ok(!gate.includes('Forgotten-password email recovery is not available yet.'));
 for(const page of ['forgot-password','reset-password']){const source=fs.readFileSync('app/'+page+'/page.tsx','utf8');assert.ok(source.includes('<SiteHeader/>'));assert.ok(source.includes('<ClientAccountGate'));assert.ok(source.includes("referrer:'no-referrer'"));}
 });

test('Owner queue repairs missing or unsent notifications without approving relationships or sending duplicates',async()=>{
 const calls=[];const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return Response.json({id:'recovery-provider-'+calls.length});}});
 x.env.RESEND_API_KEY='fictional-test-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <no-reply@lawvetter.com>';x.seed('100001','First Test Attorney');x.seed('100002','Second Test Attorney');
 x.sql.prepare("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES('recovery-client','Recovery Client','recovery@example.test','now')").run();
 for(const [id,bar] of [['first','100001'],['second','100002']])x.sql.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,updated_at) VALUES(?,'recovery-client',?,'Recovery Client','','','PRIVATE-DOCKET',?,'pending','now','now')").run(id,bar,id);
 x.sql.prepare("INSERT INTO client_verification_request_emails(id,verification_id,recipient,status,created_at) VALUES('queued-id','first','admin@example.test','pending','now')").run();
 const api=await x.load('app/api/client-reviews/route.ts');
 assert.equal((await api.POST(request({action:'admin-list'},'other','other@example.test'))).status,403);assert.equal(calls.length,0);
 assert.equal((await api.POST(request({action:'admin-list'},'owner','admin@example.test'))).status,200);assert.equal(calls.length,2);
 assert.equal(x.sql.prepare("SELECT count(*) n FROM client_verifications WHERE status='pending'").get().n,2);
 assert.equal(x.sql.prepare("SELECT count(*) n FROM client_verification_request_emails WHERE status='accepted'").get().n,2);
 assert.equal((await api.POST(request({action:'admin-list'},'owner','admin@example.test'))).status,200);assert.equal(calls.length,2);
});

test('Manual review details are required, rejection emails explain the decision, and approval links the attorney only to the right account',async()=>{
 const calls=[];const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return Response.json({id:'manual-provider-'+calls.length});}});x.seed('100001','Manual Attorney');
 x.env.RESEND_API_KEY='fictional-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <no-reply@lawvetter.com>';
 const auth=await x.load('app/api/client-auth/route.ts'),api=await x.load('app/api/client-reviews/route.ts');
 const req=(body,cookie='',owner=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(owner?{Cookie:adminTestCookie,'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
 const registered=await auth.POST(req({action:'register',firstName:'Manual',lastName:'Client',email:'manual@example.test',password:'fictional manual password',consent:true}));assert.equal(registered.status,201);const cookie=registered.headers.get('set-cookie').split(';')[0];
 const submitted={action:'request',bar:'100001',legalName:'Manual Client',state:'GA',county:'Cherokee',court:'Superior Court',partyRole:'plaintiff',opposingParty:'Other Party',documentName:'Notice of Appearance',documentDate:'2026-09-17',docket:'PRIVATE-MANUAL-CASE',requestNotes:'<img src=x onerror=alert(1)>',attestation:true};
 assert.equal((await api.POST(req({...submitted,county:''},cookie))).status,400);assert.equal((await api.POST(req({...submitted,state:'ZZ'},cookie))).status,400);assert.equal((await api.POST(req({...submitted,partyRole:'petitioner'},cookie))).status,400);assert.equal((await api.POST(req({...submitted,representationStart:'2026-02-30'},cookie))).status,400);
 assert.equal((await api.POST(req(submitted,cookie))).status,200);assert.equal(calls.length,1);
 const ownerMail=JSON.parse(calls[0].init.body);assert.ok(ownerMail.text.includes(submitted.docket));assert.ok(ownerMail.html.includes('&lt;img'));assert.ok(!ownerMail.html.includes('<img src=x'));
 const id=x.sql.prepare('SELECT id FROM client_verifications').get().id;
 await api.GET(new Request('https://lawvetter.test/api/client-reviews?request='+encodeURIComponent(id)+'&decision=approve'));assert.equal(x.sql.prepare('SELECT status FROM client_verifications WHERE id=?').get(id).status,'pending');
 assert.equal((await api.POST(req({action:'decide',id,decision:'reject',note:'Please supply the correct case number.'},cookie))).status,403);
 assert.equal((await api.POST(req({action:'decide',id,decision:'reject',note:'Please supply the correct case number.'},'',true))).status,200);assert.equal(calls.length,2);
 const rejection=JSON.parse(calls[1].init.body);assert.ok(rejection.text.includes('Please supply the correct case number.'));assert.equal(rejection.to[0],'manual@example.test');
 assert.equal((await api.POST(req({action:'publish',id,body:'A sufficiently long review that must remain locked.',mode:'anonymous',consent:true,rating_use_again:5,rating_cared_for:4,rating_rights:3,rating_outcome:2},cookie))).status,403);
 assert.equal((await api.POST(req({...submitted,docket:'CORRECTED-CASE'},cookie))).status,200);
 const approve={action:'decide',id,decision:'approve',county:'Cherokee',court:'Superior Court',source:'https://court.example.gov/cases/corrected',identityChecked:true,recordChecked:true,relationshipChecked:true,note:'Court record and counsel appearance checked.'};
 assert.equal((await api.POST(req({...approve,identityChecked:false},'',true))).status,400);
 assert.equal((await api.POST(req({...approve,relationshipChecked:false},'',true))).status,400);
 assert.equal((await api.POST(req({...approve,recordChecked:false},'',true))).status,400);
 assert.equal((await api.POST(req(approve,'',true))).status,200);
 const audit=JSON.parse(x.sql.prepare("SELECT note FROM client_verification_audit WHERE action='approved'").get().note);assert.equal(audit.identityChecked,true);assert.equal(audit.relationshipChecked,true);assert.equal(audit.recordChecked,true);
 const approval=JSON.parse(calls.at(-1).init.body);assert.ok(approval.subject.includes('Congratulations'));assert.ok(approval.text.includes('Manual Attorney'));assert.ok(approval.text.includes('My attorneys'));
 const account=await api.POST(req({action:'account'},cookie)).then(r=>r.json());assert.equal(account.requests[0].status,'approved');assert.equal(account.requests[0].state,'GA');assert.equal(account.requests[0].document_date,'2026-09-17');assert.equal(internalBar(x,account.requests[0].bar_number),'100001');
 const before=calls.length;assert.equal((await api.POST(req({action:'retry-email',id},'',true))).status,200);assert.equal(calls.length,before);
 const publicData=await api.GET(new Request('https://lawvetter.test/api/client-reviews?bar=100001')).then(r=>r.json());assert.ok(!JSON.stringify(publicData).includes('CORRECTED-CASE'));
});

test('Pending case details can be completed without duplicate requests, and the latest failed update alert is retried',async()=>{
 const calls=[];let rejectSend=false;const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return rejectSend?Response.json({error:'unavailable'},{status:503}):Response.json({id:'update-provider-'+calls.length});}});x.seed('100001','Update Attorney');
 x.env.RESEND_API_KEY='fictional-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <no-reply@lawvetter.com>';
 const auth=await x.load('app/api/client-auth/route.ts'),api=await x.load('app/api/client-reviews/route.ts');
 const req=(body,cookie='',owner=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(owner?{Cookie:adminTestCookie,'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
 const registered=await auth.POST(req({action:'register',firstName:'Update',lastName:'Client',email:'update@example.test',password:'fictional update password',consent:true}));const cookie=registered.headers.get('set-cookie').split(';')[0];
 const fields={bar:'100001',legalName:'Update Client',state:'GA',county:'Cherokee',court:'Superior Court',partyRole:'plaintiff',docket:'CASE-UPDATE',attestation:true};
 assert.equal((await api.POST(req({action:'update-request',...fields},cookie))).status,409);
 const user=x.sql.prepare('SELECT user_id FROM client_profiles').get().user_id,id=JSON.stringify([user,'100001']);
 x.sql.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,updated_at) VALUES(?,?,?,'Update Client','','','CASE-UPDATE','legacy-key','pending','old','old')").run(id,user,'100001');
 assert.equal((await api.POST(req({action:'update-request',...fields},cookie))).status,200);assert.equal(calls.length,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM client_verifications').get().n,1);assert.equal(x.sql.prepare('SELECT county FROM client_verifications').get().county,'Cherokee');
 assert.equal((await api.POST(req({action:'request',...fields},cookie))).status,409);assert.equal(calls.length,1);
 const before=x.sql.prepare('SELECT * FROM client_verifications').get();assert.equal((await api.POST(req({action:'update-request',...fields}))).status,401);assert.deepEqual(x.sql.prepare('SELECT * FROM client_verifications').get(),before);
 rejectSend=true;assert.equal((await api.POST(req({action:'update-request',...fields,requestNotes:'Updated court details.'},cookie))).status,200);assert.equal(calls.length,2);
 rejectSend=false;assert.equal((await api.POST(req({action:'admin-list'},'',true))).status,200);assert.equal(calls.length,3);assert.ok(JSON.parse(calls.at(-1).init.body).text.includes('Updated court details.'));assert.equal(calls[1].init.headers['Idempotency-Key'],calls[2].init.headers['Idempotency-Key']);
 x.sql.prepare("UPDATE client_verifications SET status='approved'").run();assert.equal((await api.POST(req({action:'update-request',...fields},cookie))).status,409);assert.equal(x.sql.prepare('SELECT status FROM client_verifications').get().status,'approved');
});

test('Authenticated administrator can verify a client request tied to their own email; client sessions cannot approve it',async()=>{
 const x=await runtime();x.seed('100001','Owner Request Attorney');
 const auth=await x.load('app/api/client-auth/route.ts'),api=await x.load('app/api/client-reviews/route.ts');
 const req=(body,cookie='',admin=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(admin?{Cookie:adminTestCookie,'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
 const registered=await auth.POST(req({action:'register',firstName:'Owner',lastName:'Client',email:'admin@example.test',password:'fictional owner passphrase',consent:true}));assert.equal(registered.status,201);const cookie=registered.headers.get('set-cookie').split(';')[0];
 assert.equal((await api.POST(req({action:'request',bar:'100001',legalName:'Owner Client',state:'GA',county:'Cherokee',court:'Superior Court',partyRole:'plaintiff',docket:'OWNER-CASE',attestation:true},cookie))).status,200);
 const row=x.sql.prepare('SELECT id FROM client_verifications').get();
 const decision={action:'decide',id:row.id,decision:'approve',county:'Cherokee',court:'Superior Court',source:'https://court.example.gov/case/owner',note:'Manually checked the court record.',identityChecked:true,recordChecked:true,relationshipChecked:true};
 assert.equal((await api.POST(req(decision,cookie))).status,403);
 assert.equal((await api.POST(req(decision,'',true))).status,200);
 assert.equal((await api.POST(req({action:'account'},cookie)).then(r=>r.json())).requests[0].status,'approved');
 assert.equal((await api.POST(req(decision,'',true))).status,409);
 assert.equal(x.sql.prepare("SELECT count(*) n FROM client_verification_audit WHERE action='approved'").get().n,1);
});

test('Verified clients publish immediately; later edits wait for approval and rejected edits preserve the public review',async()=>{
 const calls=[];const x=await runtime({fetch:async(url,init)=>{calls.push(JSON.parse(init.body));return Response.json({id:'moderation-mail-'+calls.length});}});x.seed('100001','Moderated Attorney');x.env.RESEND_API_KEY='fictional-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <no-reply@lawvetter.com>';
 const auth=await x.load('app/api/client-auth/route.ts'),api=await x.load('app/api/client-reviews/route.ts');
 const req=(body,cookie='',owner=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(owner?{Cookie:adminTestCookie,'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
 const registration=await auth.POST(req({action:'register',firstName:'Review',lastName:'Client',email:'review@example.test',password:'fictional review passphrase',consent:true}));const cookie=registration.headers.get('set-cookie').split(';')[0];
 const user=x.sql.prepare('SELECT user_id FROM client_profiles').get().user_id,id=JSON.stringify([user,'100001']);
 x.sql.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,updated_at) VALUES(?,?,?,'Review Client','Court','County','PRIVATE-CASE','private-key','approved','now','now')").run(id,user,'100001');
 const original={action:'publish',id,body:'Great lawyer.',mode:'anonymous',consent:true,rating_use_again:5,rating_cared_for:4,rating_rights:3,rating_outcome:2};
 const publicPage=()=>api.GET(new Request('https://lawvetter.test/api/client-reviews?bar=100001')).then(r=>r.json());
 assert.equal((await api.POST(req(original,cookie))).status,200);assert.equal((await publicPage()).reviews[0].body,'Great lawyer.');assert.equal(calls.length,0);
 let revision=x.sql.prepare('SELECT review_revision FROM client_verifications').get().review_revision;
 const decision={action:'review-decide',id,revision,decision:'approve'};
 assert.equal((await api.POST(req(decision,cookie))).status,403);
 
 assert.equal((await api.POST(req({...decision,revision:'stale'},'',true))).status,409);
 assert.equal((await api.POST(req(decision,'',true))).status,409);assert.equal((await publicPage()).reviews[0].body,'Great lawyer.');
 assert.equal((await api.POST(req(decision,'',true))).status,409);
 const edit={...original,body:'Changed proposed review.',mode:'named',rating_outcome:1};
 assert.equal((await api.POST(req(edit,cookie))).status,200);assert.equal(calls.at(-1).to[0],'admin@example.test');assert.equal((await api.POST(req({...edit,body:'Another unapproved edit'},cookie))).status,409);let page=await publicPage();assert.equal(page.reviews[0].body,'Great lawyer.');assert.equal(page.reviews[0].author,'Anonymous');assert.equal(page.reviews[0].rating_outcome,2);
 revision=x.sql.prepare('SELECT review_revision FROM client_verifications').get().review_revision;
 assert.equal((await api.POST(req({action:'review-decide',id,revision,decision:'reject',note:'Please revise the submitted text.'},'',true))).status,200);assert.equal((await publicPage()).reviews[0].body,'Great lawyer.');
 assert.equal((await api.POST(req(edit,cookie))).status,200);revision=x.sql.prepare('SELECT review_revision FROM client_verifications').get().review_revision;
 assert.equal((await api.POST(req({action:'review-decide',id,revision,decision:'approve'},'',true))).status,200);page=await publicPage();assert.equal(page.reviews[0].body,edit.body);assert.equal(page.reviews[0].author,'Review C.');assert.equal(page.reviews[0].rating_outcome,1);
 assert.ok(!JSON.stringify(page).includes('PRIVATE-CASE'));assert.ok(!JSON.stringify(page).includes('review_draft'));
 assert.equal((await api.POST(req({...original,body:'Another proposed review'},cookie))).status,200);revision=x.sql.prepare('SELECT review_revision FROM client_verifications').get().review_revision;
 const beforeDelete=x.sql.prepare('SELECT * FROM client_verifications WHERE id=?').get(id);
 assert.equal((await api.POST(req({action:'withdraw',id},cookie))).status,403);assert.deepEqual(x.sql.prepare('SELECT * FROM client_verifications WHERE id=?').get(id),beforeDelete);assert.equal((await publicPage()).reviews[0].body,edit.body);
 assert.equal((await api.POST(req({action:'review-decide',id,revision,decision:'approve'},'',true))).status,200);assert.equal((await publicPage()).reviews.length,1);
});

test('Public review feed paginates independent reviews and summarizes only public approved reviews',async()=>{
 const x=await runtime();x.seed('100001','Feed Attorney');
 x.sql.prepare("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES('feed-user','Private Name','private@example.test','now')").run();
 for(let i=0;i<8;i++)x.sql.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,updated_at,review_body,published_at,rating_use_again,rating_cared_for,rating_rights,rating_outcome) VALUES(?,'feed-user','100001','Private Name','Court','County','SECRET-CASE',?,'approved','now','now',?,?,5,4,3,2)").run('feed-'+i,'key-'+i,'Published review number '+i,'2026-10-'+String(10+i).padStart(2,'0')+'T00:00:00Z');
 const api=await x.load('app/api/client-reviews/route.ts');const get=offset=>api.GET(new Request('https://lawvetter.test/api/client-reviews?bar=100001&offset='+offset));
 const first=await(await get(0)).json(),second=await(await get(5)).json();assert.equal(first.reviews.length,5);assert.equal(second.reviews.length,3);assert.equal(first.summary.total,8);assert.equal(first.summary.average,3.5);assert.equal(first.summary.rating_cared_for,4);assert.equal(new Set([...first.reviews,...second.reviews].map(r=>r.body)).size,8);assert.equal(first.reviews[0].body,'Published review number 7');assert.ok(!JSON.stringify(first).includes('Private Name'));assert.ok(!JSON.stringify(first).includes('SECRET-CASE'));assert.equal((await get(-1)).status,400);assert.equal((await get('NaN')).status,400);
 const summaries=await api.GET(new Request('https://lawvetter.test/api/client-reviews?bars=100001,100002')).then(r=>r.json());assert.equal(summaries.summaries.length,1);assert.equal(summaries.summaries[0].total,8);assert.equal(summaries.summaries[0].average,3.5);assert.equal(summaries.summaries[0].excerpt,'Published review number 7');assert.ok(!JSON.stringify(summaries).includes('Private Name'));assert.ok(!JSON.stringify(summaries).includes('SECRET-CASE'));assert.equal((await api.GET(new Request('https://lawvetter.test/api/client-reviews?bars=invalid'))).status,400);
});

test('Highest-rated attorney ranking is independent of searches, uses only published complete ratings, and breaks ties by rated review count',async()=>{
 const x=await runtime();x.seed('100001','Most Searched');x.seed('100002','High Rated');x.seed('100003','Same Rating More Reviews');x.seed('100004','Inactive Rated','','Inactive Member in Good Standing');x.seed('100005','Unpublished Rated');x.seed('100006','Legacy Unrated');
 x.sql.prepare("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES('rating-user','Private Client','private@example.test','now')").run();
 const add=(id,bar,rating,{published='2026-10-10T00:00:00Z',status='approved'}={})=>x.sql.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,updated_at,review_body,published_at,rating_use_again,rating_cared_for,rating_rights,rating_outcome) VALUES(?,'rating-user',?,'Private Client','Court','County','PRIVATE-CASE',?,?,'now','now','Published review content',?,?,?,?,?)").run(id,bar,id,status,published,rating,rating,rating,rating);
 add('low','100001',1);add('high','100002',5);add('tie-one','100003',5);add('tie-two','100003',5);add('inactive','100004',5);add('draft','100005',5,{published:null});add('pending','100005',5,{status:'pending'});add('legacy','100006',null);
 for(let i=0;i<10;i++)x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('search-'+i,'100001','2026-10-10T12:00:00Z');
 // Proposed edits do not change the public ratings before approval.
 x.sql.prepare("UPDATE client_verifications SET review_status='pending',review_draft=? WHERE id='low'").run(JSON.stringify({rating_use_again:5}));
 const charts=await x.load('app/api/attorneys/charts.ts');const bounds=['2026-10-01T00:00:00Z','2026-10-12T23:59:59Z'];
 assert.equal(x.sql.prepare(charts.attorneyChartSQL).all(...bounds)[0].bar_number,'100001');
 const ranked=x.sql.prepare(charts.ratedAttorneyChartSQL).all(...bounds);assert.deepEqual(ranked.map(r=>r.bar_number),['100003','100002','100001']);assert.deepEqual(ranked.map(r=>r.rank),[1,2,3]);assert.equal(ranked[0].review_count,2);assert.equal(ranked[1].review_average,5);assert.equal(ranked[2].review_average,1);
 assert.equal(x.sql.prepare(charts.ratedAttorneyChartSQL).all('2026-10-11T00:00:00Z',bounds[1]).length,0);
 const discovery=await charts.discoveryData(x.db);assert.ok(Array.isArray(discovery.ratedAll));assert.ok(Array.isArray(discovery.ratedWeekly));assert.ok(Array.isArray(discovery.ratedMonthly));assert.ok(!JSON.stringify(discovery.ratedAll).includes('Private Client'));assert.ok(!JSON.stringify(discovery.ratedAll).includes('PRIVATE-CASE'));
});

test('Password attorney onboarding stays separate from administrator access and publishes new profiles only after verified approval',async()=>{
 const x=await runtime();x.seed('100001','Existing Attorney');
 const auth=await x.load('app/api/client-auth/route.ts'),profiles=await x.load('app/api/profiles/route.ts'),directory=await x.load('app/api/directory-submissions/route.ts'),photos=await x.load('app/api/profile-photo/route.ts');
 const registered=await auth.POST(request({action:'register',email:'new-attorney@example.test',password:'test strong password',firstName:'New',lastName:'Attorney',consent:true},''));assert.equal(registered.status,201);const cookie=registered.headers.get('set-cookie').split(';')[0];
 function client(data,session=cookie){const r=request(data,'');r.headers.set('Cookie',session);return r;}
 assert.equal((await profiles.POST(request({action:'account',authentication:'password'},'admin','admin@example.test'))).status,401);
 const account=await(await profiles.POST(client({action:'account',authentication:'password'}))).json();assert.equal(account.isAdmin,false);assert.equal(account.profiles.length,0);
 assert.equal((await profiles.POST(client({action:'review-list'}))).status,403);
 const claim=await profiles.POST(client({action:'claim',authentication:'password',bar:'100001',fullName:'Existing Attorney',verification:'Independent firm biography for verification.',attestation:true}));assert.equal(claim.status,200);
 const claimId=x.sql.prepare('SELECT id FROM profile_claims WHERE bar_number=?').get('100001').id;x.sql.prepare('UPDATE profile_claims SET firm_email_verified_at=? WHERE id=?').run('2026-10-13',claimId);
 assert.equal((await profiles.POST(request({action:'review',id:claimId,decision:'approve',verified:true},'admin','admin@example.test'))).status,200);
 const save={action:'save',authentication:'password',bar:'100001',headline:'My headline',bio:'My biography',practiceAreas:'Family law',website:'https://example.test/'};
 assert.equal((await profiles.POST(client(save))).status,200);assert.equal((await profiles.POST(client(save,''))).status,401);
 const draft={languages:'Spanish, French',action:'submit',attorneyProfile:true,kind:'lawyer',practiceAreas:'Family law',state:'GA',barNumber:'100002',name:'New Attorney',submitterName:'New Attorney',submitterEmail:'spoof@example.test',officialSourceUrl:'https://example.test/official',firmName:'New Law LLC',firmWebsite:'https://newlaw.example.test/',firmLinkedInUrl:'https://www.linkedin.com/company/new-law/',city:'Atlanta',headline:'New headline',bio:'New biography',linkedinUrl:'https://www.linkedin.com/in/new-attorney/',practiceAreas:'Family law',phone:'555-0100',publicEmail:'contact@example.test',website:'https://newlaw.example.test/attorney',address:'123 Main Street',county:'Fulton',admitDate:'2020-05-01',lawSchool:'Test Law School',notes:'Verify my firm biography and account email.',attestation:true};
 assert.equal((await directory.POST(request(draft,''))).status,401);
 for(const practiceAreas of ['', ' , ; | ']){const missing=await directory.POST(client({...draft,practiceAreas}));assert.equal(missing.status,400);assert.match((await missing.json()).error,/at least one practice area/);}

 assert.equal((await directory.POST(client({...draft,barNumber:'100001'}))).status,409);
 const submitted=await directory.POST(client(draft));assert.equal(submitted.status,200);const {id}=await submitted.json();assert.equal(x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('100002'),undefined);
 const record=x.sql.prepare('SELECT * FROM directory_submissions WHERE id=?').get(id);assert.equal(record.submitter_email,'new-attorney@example.test');
 const imageBytes=new Uint8Array(32);imageBytes.set([137,80,78,71,13,10,26,10]);const form=new FormData();form.set('submission',id);form.set('photo',new File([imageBytes],'photo.png',{type:'image/png'}));
 const upload=new Request('https://lawvetter.test/api/profile-photo',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie},body:form});assert.equal((await photos.POST(upload)).status,200);
 const photoURL='https://lawvetter.test/api/profile-photo?submission='+id;assert.equal((await photos.GET(new Request(photoURL))).status,404);assert.equal((await photos.GET(new Request(photoURL,{headers:{Cookie:cookie}}))).status,200);
 const review={action:'review',id,decision:'approve',officiallyVerified:true,identityVerified:true,barStatus:'Active Member in Good Standing'};
 assert.equal((await directory.POST(client(review))).status,403);assert.equal((await directory.POST(request({...review,identityVerified:false},'admin','admin@example.test'))).status,400);
 assert.equal((await directory.POST(request(review,'admin','admin@example.test'))).status,200);
 const approved=x.sql.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get('100002');assert.equal(x.sql.prepare('SELECT website FROM firm_settings WHERE key=?').get('newlawllc').website,draft.firmWebsite);assert.equal(x.sql.prepare('SELECT linkedin_url FROM firm_settings WHERE key=?').get('newlawllc').linkedin_url,draft.firmLinkedInUrl);const publishedAttorney=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('100002');for(const [field,column] of Object.entries({address:'address',county:'county',phone:'phone',publicEmail:'email',admitDate:'admit_date',lawSchool:'law_school'}))assert.equal(publishedAttorney[column],draft[field]);for(const [field,column] of Object.entries({website:'website',bio:'bio',practiceAreas:'practice_areas'}))assert.equal(approved[column],draft[field]);assert.equal(approved.languages,'Spanish, French');assert.equal(approved.headline,'New headline');assert.equal(approved.linkedin_url,'https://www.linkedin.com/in/new-attorney/');assert.ok(approved.photo_key.startsWith('submissions/'));assert.equal(x.sql.prepare('SELECT status FROM directory_submissions WHERE id=?').get(id).status,'published');
 const own=await(await profiles.POST(client({action:'account',authentication:'password'}))).json();assert.equal(own.profiles.length,2);assert.equal(own.submissions.length,1);assert.equal('notes' in own.submissions[0],false);
 const other=await auth.POST(request({action:'register',email:'other-attorney@example.test',password:'another strong password',firstName:'Other',lastName:'Attorney',consent:true},''));assert.equal(other.status,201);const otherCookie=other.headers.get('set-cookie').split(';')[0];assert.equal((await profiles.POST(client({...save,bar:'100002'},otherCookie))).status,403);
 assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('100001').name,'Existing Attorney');
 assert.equal((await directory.POST(request(review,'admin','admin@example.test'))).status,409);
 await auth.POST(client({action:'logout'}));assert.equal((await profiles.POST(client({action:'account',authentication:'password'}))).status,401);
});

test('Existing platform-owned attorney profiles retain ownership when their original owner sets a password',async()=>{
 const x=await runtime();x.seed('100001','Original Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,headline,claimed_at,updated_at) VALUES(?,?,?,?,?)').run('100001','original-owner','Keep this headline','2026-10-08','2026-10-08');
 const auth=await x.load('app/api/client-auth/route.ts'),profiles=await x.load('app/api/profiles/route.ts');
 assert.equal((await auth.POST(request({action:'set-password',password:'strong test password'},'different-owner','original@example.test'))).status,403);
 const legacy=await(await auth.GET(request({},'original-owner','original@example.test'))).json();assert.equal(legacy.attorneyLegacy.name,'Original Attorney');
 const saved=await auth.POST(request({action:'set-password',password:'strong test password'},'original-owner','original@example.test'));assert.equal(saved.status,200);
 const r=request({action:'account',authentication:'password'},'');r.headers.set('Cookie',saved.headers.get('set-cookie').split(';')[0]);const account=await(await profiles.POST(r)).json();assert.equal(account.profiles.length,1);assert.equal(account.profiles[0].headline,'Keep this headline');assert.equal(account.isAdmin,false);assert.equal(x.sql.prepare('SELECT owner_id FROM attorney_profiles WHERE bar_number=?').get('100001').owner_id,'original-owner');
});

test('Directory notices use Resend once, preserve the saved firm website, and retry previously unsent requests',async()=>{
 const calls=[];let accept=false;const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return accept?Response.json({id:'resend-directory-id'}):Response.json({error:'temporary failure'},{status:503});}});x.env.RESEND_API_KEY='test-secret';x.env.APPROVAL_EMAIL_FROM='LawVetter <no-reply@lawvetter.com>';x.env.CLAIM_ADMIN_EMAIL='admin@example.test';
 const api=await x.load('app/api/directory-submissions/route.ts'),details=await x.load('db/directory-details.ts');
 const draft={action:'submit',kind:'lawyer',practiceAreas:'Family law',name:'Suggested Attorney',state:'GA',barNumber:'100005',city:'Atlanta',firmName:'Suggested Law LLC',firmWebsite:'https://suggested-law.example/',website:'https://suggested-law.example/attorney',officialSourceUrl:'https://example.test/licensing',submitterName:'Test Submitter',submitterEmail:'submitter@example.test',notes:'Check the official record.'};
 const saved=await(await api.POST(request(draft,''))).json();assert.equal(saved.notificationEmailStatus,'pending');const record=x.sql.prepare('SELECT * FROM directory_submissions WHERE id=?').get(saved.id);assert.equal(details.directoryDetails(record.notes).firmWebsite,draft.firmWebsite);assert.equal(calls[0].url,'https://api.resend.com/emails');const payload=JSON.parse(calls[0].init.body);assert.equal(payload.to[0],'admin@example.test');assert.equal(payload.from,'LawVetter <no-reply@lawvetter.com>');assert.ok(payload.text.includes('Suggested Attorney'));assert.ok(payload.text.includes(draft.firmWebsite));assert.ok(payload.text.includes('/admin/directory-submissions#submission-'));
 accept=true;const retry=await(await api.POST(request({action:'retry-notifications'},''))).json();assert.equal(retry.accepted,1);assert.equal(calls[1].init.headers['Idempotency-Key'],calls[0].init.headers['Idempotency-Key']);assert.equal(calls[1].init.body,calls[0].init.body);await api.POST(request({action:'retry-notifications'},''));assert.equal(calls.length,2);
 assert.equal((await api.POST(request({action:'review',id:saved.id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);const directory=await x.load('app/api/attorneys/route.ts');const firm=await(await directory.POST(request({firm:'Suggested Law LLC'}))).json();assert.equal(firm.firm.website,draft.firmWebsite);
});

test('Configured directory CAPTCHA rejects missing, expired, reused, and wrong-host tokens; submission rate limits and spam traps remain enforced',async()=>{
 const used=new Set();const x=await runtime({fetch:async(url,init)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');const d=JSON.parse(init.body);assert.equal(d.secret,'private-captcha-secret');if(d.response==='expired'||used.has(d.response))return Response.json({success:false});used.add(d.response);return Response.json({success:true,hostname:d.response==='wrong-host'?'wrong.test':'lawvetter.test',action:'directory_submission'});}});x.env.TURNSTILE_SITE_KEY='public-site-key';x.env.TURNSTILE_SECRET_KEY='private-captcha-secret';const api=await x.load('app/api/directory-submissions/route.ts');const config=await(await api.GET()).json();assert.equal(config.siteKey,'public-site-key');assert.equal(JSON.stringify(config).includes('private-captcha-secret'),false);
 const draft={status:'Member in Good Standing',city:'Atlanta',action:'submit',kind:'lawyer',practiceAreas:'Family law',name:'Captcha Attorney',state:'GA',barNumber:'100010',officialSourceUrl:'https://example.test/licensing',submitterName:'Test Submitter',submitterEmail:'captcha@example.test'};
 for(const captchaToken of [undefined,'expired','wrong-host'])assert.equal((await api.POST(request({...draft,captchaToken},''))).status,400);
 assert.equal((await api.POST(request({...draft,captchaToken:'valid-token'},''))).status,200);
 assert.equal((await api.POST(request({...draft,name:'Another Attorney',barNumber:'100011',captchaToken:'valid-token'},''))).status,400);
 assert.equal(x.sql.prepare('SELECT count(*) AS total FROM directory_submissions').get().total,1);
 assert.equal((await api.POST(request({...draft,captchaToken:'new-token',companyWebsite:'bot value'},''))).status,400);
 for(let i=0;i<5;i++)await api.POST(request({...draft,captchaToken:'invalid-'+i},''));assert.equal((await api.POST(request({...draft,captchaToken:'final'},''))).status,429);
});

test('Most searched attorney charts return up to 50 ranked attorneys for each period',async()=>{
 const x=await runtime(),now=new Date().toISOString();for(let i=0;i<60;i++){const bar=String(100000+i);x.seed(bar,'Attorney '+String(i).padStart(2,'0'));for(let j=0;j<60-i;j++)x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('rank-'+i+'-'+j,bar,now);}const charts=await x.load('app/api/attorneys/charts.ts'),data=await charts.discoveryData(x.db);for(const list of [data.weekly,data.monthly]){assert.equal(list.length,50);assert.equal(list[0].bar_number,'100000');assert.equal(list[49].bar_number,'100049');assert.equal(list[49].rank,50);}
});

test('Administrator approval publishes suggested attorneys immediately and admin photos do not falsely mark a profile as claimed',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts'),photos=await x.load('app/api/profile-photo/route.ts'),profiles=await x.load('app/api/profiles/route.ts');
 const submitted=await(await api.POST(request({action:'submit',kind:'lawyer',practiceAreas:'Family law',name:'Florida Test Attorney',state:'FL',barNumber:'1001234',city:'Tampa',firmName:'Test Florida Law',officialSourceUrl:'https://example.test/licensing',submitterName:'Test Submitter',submitterEmail:'submitter@example.test'},''))).json();
 const bytes=new Uint8Array(32);bytes.set([137,80,78,71,13,10,26,10]);function upload(user,email){const form=new FormData();form.set('submission',submitted.id);form.set('photo',new File([bytes],'photo.png',{type:'image/png'}));return new Request('https://lawvetter.test/api/profile-photo',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:email==='admin@example.test'?adminTestCookie:'','oai-authenticated-user-id':user,'oai-authenticated-user-email':email},body:form});}
 assert.equal((await photos.POST(upload('other','other@example.test'))).status,403);assert.equal((await photos.POST(upload('admin','admin@example.test'))).status,200);
 assert.equal((await api.POST(request({action:'review',id:submitted.id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 const attorney=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('FL:1001234');assert.equal(attorney.state,'FL');const profile=x.sql.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get('FL:1001234');assert.equal(profile.owner_id,'');assert.equal(profile.claimed_at,'');assert.ok(profile.photo_key);
 const directory=await x.load('app/api/attorneys/route.ts'),search=await(await directory.POST(request({q:'Florida Test Attorney',statusGroup:'active'}))).json();assert.equal(search.total,1);assert.equal(search.attorneys[0].state,'FL');assert.equal((await photos.GET(new Request('https://lawvetter.test/api/profile-photo?bar=FL:1001234'))).status,200);
 assert.equal((await photos.POST(upload('admin','admin@example.test'))).status,200);
 assert.equal((await profiles.POST(request({action:'claim',bar:'FL:1001234',fullName:'Florida Test Attorney',verification:'Official firm biography and independent verification.',attestation:true},'attorney','attorney@example.test'))).status,200);const claim=x.sql.prepare('SELECT id FROM profile_claims WHERE bar_number=?').get('FL:1001234');x.sql.prepare('UPDATE profile_claims SET firm_email_verified_at=? WHERE id=?').run('2026-10-13',claim.id);assert.equal((await profiles.POST(request({action:'review',id:claim.id,decision:'approve',verified:true},'admin','admin@example.test'))).status,200);const owned=x.sql.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get('FL:1001234');assert.equal(owned.owner_id,'attorney');assert.ok(owned.claimed_at);assert.ok(owned.photo_key);
});

test('Publication repair imports only already-approved Florida listings with matching active official records',async()=>{
 const x=await runtime({fetch:async()=>new Response('<h1>Approved Test Attorney</h1> Bar Number: 1001234 Member in Good Standing Eligible to Practice Law in Florida')});const now=new Date().toISOString();for(const [id,status,reviewed] of [['approved','approved_for_import','admin'],['pending','pending','']])x.sql.prepare('INSERT INTO directory_submissions(id,kind,name,state,bar_number,city,official_source_url,submitter_name,submitter_email,status,submitted_at,reviewed_by) VALUES(?,?,?,?,?,\'Miami\',?,?,?,?,?,?)').run(id,'lawyer','Approved Test Attorney','FL','1001234','https://www.floridabar.org/directories/find-mbr/profile/?num=1001234','Submitter','submitter@example.test',status,now,reviewed);
 const api=await x.load('app/api/directory-submissions/route.ts');assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,1);assert.equal(x.sql.prepare('SELECT status FROM directory_submissions WHERE id=?').get('pending').status,'pending');assert.equal(x.sql.prepare('SELECT status FROM directory_submissions WHERE id=?').get('approved').status,'published');assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,0);
});

test('The specific historical listing repair still requires a saved administrator approval and preserves all other records',async()=>{
 const x=await runtime({fetch:async()=>new Response('Blocked',{status:403})}),repair=await x.load('db/approved-listing-repairs.ts');const r=repair.approvedListingRepair,now=new Date().toISOString();x.seed('100001','Existing Attorney');x.sql.prepare('INSERT INTO directory_submissions(id,kind,name,state,bar_number,city,official_source_url,submitter_name,submitter_email,status,submitted_at) VALUES(?,?,?,?,?,\'Miami\',?,?,?,?,?)').run(r.id,'lawyer',r.name,r.state,r.bar,'https://www.floridabar.org/directories/find-mbr/profile/?num='+r.bar,'Submitter','submitter@example.test','pending',now);const api=await x.load('app/api/directory-submissions/route.ts');assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,0);x.sql.prepare("UPDATE directory_submissions SET status='approved_for_import',reviewed_by='admin' WHERE id=?").run(r.id);assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,1);assert.equal(x.sql.prepare('SELECT state FROM attorneys WHERE bar_number=?').get('FL:'+r.bar).state,'FL');assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('100001').name,'Existing Attorney');
});

test('State names and abbreviations search Florida records with pagination and intersect city and practice filters',async()=>{
 const x=await runtime();for(let i=0;i<30;i++){const bar=String(700000+i);x.seed(bar,'Example Attorney '+i);x.sql.prepare("UPDATE attorneys SET state='FL',city=? WHERE bar_number=?").run(i<26?'Miami':'Tampa',bar);}x.seed('900000','Florida Named Georgia Attorney');
 const api=await x.load('app/api/attorneys/route.ts');
 for(const query of ['q=Florida','q=FL','city=Florida','city=fl']){const result=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?'+query+'&statusGroup=active'))).json();assert.equal(result.total,30);assert.equal(result.attorneys.length,24);assert.ok(result.attorneys.every(a=>a.state==='FL'));}
 const second=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=Florida&page=2'))).json();assert.equal(second.attorneys.length,6);
 const city=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=Florida&city=Miami'))).json();assert.equal(city.total,26);
 const practice=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=Florida&practice=family-law'))).json();assert.equal(practice.total,0);
});

test('Unified text search recognizes practice categories and retains firm and license searches',async()=>{
 const x=await runtime();x.seed('004170','Randall M Kessler');x.seed('900010','Other Attorney');x.sql.prepare("UPDATE attorneys SET company='Example Family Law Firm' WHERE bar_number='900010'").run();const api=await x.load('app/api/attorneys/route.ts');
 for(const q of ['family law','Family Law','family-law']){const result=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q='+encodeURIComponent(q)))).json();assert.equal(result.total,1);assert.equal(internalBar(x,result.attorneys[0].bar_number),'004170');}
 for(const q of ['Example Family Law Firm','900010']){const result=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q='+encodeURIComponent(q)))).json();assert.equal(result.total,q==='Example Family Law Firm'?2:1);assert.equal(result.attorneys.length,1);assert.equal(internalBar(x,result.attorneys[0].bar_number),'900010');}
});

test('Administrator password setup is email-verified, single-use, and independent of typed email or ChatGPT headers',async()=>{
 let emailMessage='';const x=await runtime({fetch:async(url,opts)=>{emailMessage=JSON.parse(opts.body).text;assert.deepEqual(JSON.parse(opts.body).to,['admin@example.test']);return Response.json({id:'admin-reset-email'});}});x.sql.exec('DELETE FROM admin_credentials; DELETE FROM admin_sessions');x.env.RESEND_API_KEY='test';x.env.APPROVAL_EMAIL_FROM='from@example.test';
 const api=await x.load('app/api/admin/auth/route.ts'),identity=await x.load('db/profile-access.ts');
 const req=(body,cookie='')=>new Request('https://lawvetter.test/api/admin/auth',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,'Content-Type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'},body:JSON.stringify(body)});
 assert.equal((await identity.profileIdentity(req({}))).admin,false);
 await api.POST(req({action:'request-reset',email:'attacker@example.test'}));assert.equal(emailMessage,'');
 assert.equal((await api.POST(req({action:'reset',email:'admin@example.test',token:'00'.repeat(32),password:'A long test password'}))).status,400);
 await api.POST(req({action:'request-reset',email:'admin@example.test'}));const token=emailMessage.match(/setup=([a-f0-9]{64})/)[1];
 assert.equal((await api.POST(req({action:'reset',email:'admin@example.test',token,password:'A long test password'}))).status,200);
 assert.equal((await api.POST(req({action:'reset',email:'admin@example.test',token,password:'Another long password'}))).status,400);
 assert.equal((await api.POST(req({action:'login',email:'admin@example.test',password:'wrong password'}))).status,401);
 const login=await api.POST(req({action:'login',email:'admin@example.test',password:'A long test password'}));assert.equal(login.status,200);assert.equal(login.headers.get('set-cookie'),null);const challenge=(await login.json()).challenge;const code=emailMessage.match(/code is (\d{6})/)[1];const verify=await api.POST(req({action:'verify',challenge,code}));assert.equal(verify.status,200);const cookie=verify.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);const credential=cookie.split(';')[0];
 assert.equal((await identity.profileIdentity(req({},credential))).admin,true);
 await api.POST(req({action:'logout'},credential));assert.equal((await identity.profileIdentity(req({},credential))).admin,false);
 const stored=x.sql.prepare('SELECT password_hash FROM admin_credentials').get();assert.match(stored.password_hash,/^scrypt\$/);assert.ok(!stored.password_hash.includes('A long test password'));
});
test('Admin API access denies missing, forged, expired, and ordinary-client credentials; retired news cannot be read or updated',async()=>{
 const x=await runtime(),leads=await x.load('app/api/leads/route.ts'),news=await x.load('app/api/news/route.ts');
 for(const cookie of ['', '__Host-lawvetter-admin='+'ff'.repeat(32),'__Host-lawvetter-client='+adminTestToken]){const r=new Request('https://lawvetter.test/api/leads',{headers:{Cookie:cookie,'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}});assert.equal((await leads.GET(r)).status,403);}
 x.sql.prepare('UPDATE admin_sessions SET expires_at=0').run();assert.equal((await leads.GET(new Request('https://lawvetter.test/api/leads',{headers:{Cookie:adminTestCookie}}))).status,403);
 assert.equal((await news.GET()).status,410);
 assert.equal((await news.PUT(new Request('https://lawvetter.test/api/news',{method:'PUT',headers:{Origin:'https://lawvetter.test'},body:'{}'}))).status,410);
});

test('Admin email code is mandatory, expires, has five attempts, and cannot be replayed',async()=>{
 let code='';const x=await runtime({fetch:async(_,opts)=>{code=JSON.parse(opts.body).text.match(/code is (\d{6})/)[1];return Response.json({id:'code'});}});x.env.RESEND_API_KEY='test';x.env.APPROVAL_EMAIL_FROM='from@example.test';const {hashPassword}=await x.load('db/client-auth.ts');x.sql.prepare('UPDATE admin_credentials SET password_hash=?').run(hashPassword('A unique admin password'));
 const api=await x.load('app/api/admin/auth/route.ts'),req=d=>new Request('https://lawvetter.test/api/admin/auth',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify(d)});
 const login=await api.POST(req({action:'login',email:'admin@example.test',password:'A unique admin password'}));assert.equal(login.headers.get('set-cookie'),null);const {challenge}=await login.json();const wrong=code==='000000'?'000001':'000000';for(let i=0;i<5;i++)assert.equal((await api.POST(req({action:'verify',challenge,code:wrong}))).status,401);assert.equal((await api.POST(req({action:'verify',challenge,code}))).status,401);
 x.sql.exec('DELETE FROM client_auth_limits');const second=await(await api.POST(req({action:'login',email:'admin@example.test',password:'A unique admin password'}))).json();const verified=await api.POST(req({action:'verify',challenge:second.challenge,code}));assert.equal(verified.status,200);assert.match(verified.headers.get('set-cookie'),/Max-Age=10800/);assert.equal((await api.POST(req({action:'verify',challenge:second.challenge,code}))).status,401);
 const third=await(await api.POST(req({action:'login',email:'admin@example.test',password:'A unique admin password'}))).json();x.sql.exec('UPDATE admin_challenges SET expires_at=0');assert.equal((await api.POST(req({action:'verify',challenge:third.challenge,code}))).status,401);
});
test('Admin sessions allow three-hour reviews and missing email delivery cannot bypass verification',async()=>{
 const x=await runtime(),{adminIdentity,adminSessionMs,adminCookie,createAdminSession}=await x.load('db/admin-auth.ts'),req=new Request('https://lawvetter.test/admin',{headers:{Cookie:adminTestCookie}});assert.equal(adminSessionMs,10800000);assert.ok(await adminIdentity(req));x.sql.prepare('UPDATE admin_sessions SET expires_at=?,last_seen=?').run(Date.now()+adminSessionMs,Date.now()-1200001);assert.ok(await adminIdentity(req));x.sql.prepare('UPDATE admin_sessions SET last_seen=?').run(Date.now()-adminSessionMs+10000);assert.ok(await adminIdentity(req));x.sql.prepare('UPDATE admin_sessions SET last_seen=?').run(Date.now()-adminSessionMs-1);assert.equal(await adminIdentity(req),null);const token=await createAdminSession('admin@example.test'),fresh=new Request('https://lawvetter.test/admin',{headers:{Cookie:adminCookie(token).split(';')[0]}});assert.match(adminCookie(token),/Max-Age=10800/);assert.match(adminCookie(''),/Max-Age=0/);x.advance(adminSessionMs-10000);assert.ok(await adminIdentity(fresh));x.advance(10001);assert.equal(await adminIdentity(fresh),null);
 const {hashPassword}=await x.load('db/client-auth.ts');x.sql.prepare('UPDATE admin_credentials SET password_hash=?').run(hashPassword('A unique admin password'));const api=await x.load('app/api/admin/auth/route.ts');const failed=await api.POST(new Request('https://lawvetter.test/api/admin/auth',{method:'POST',headers:{Origin:'https://lawvetter.test'},body:JSON.stringify({action:'login',email:'admin@example.test',password:'A unique admin password'})}));assert.equal(failed.status,503);assert.equal(failed.headers.get('set-cookie'),null);
});
test('Spreadsheet import skips existing licenses and repeated rows, preserves complete profiles, and adds searchable new attorneys',async()=>{
 const x=await runtime();x.seed('100001','Existing Attorney');x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio,photo_key) VALUES('100001','owner','2026-01-01','2026-01-01','Keep my bio','attorneys/100001/photo.jpg')").run();x.sql.prepare("UPDATE attorneys SET license_number='100001',phone='5551234' WHERE bar_number='100001'").run();const api=await x.load('app/api/admin/spreadsheet/route.ts'),req=d=>request(d,'admin','admin@example.test');const rows=[{status:'Member in Good Standing',city:'Atlanta',barNumber:'100001',state:'GA',name:'Updated Attorney',phone:'',photoKey:'',practiceAreas:'Family law'},{status:'Member in Good Standing',city:'Atlanta',barNumber:'100001',state:'FL',name:'Florida Attorney',company:'New Firm',practiceAreas:'Immigration',photoKey:'https://example.test/photo.jpg'}];
 assert.equal((await api.POST(request({rows},''))).status,401);const preview=await(await api.POST(req({rows,preview:true}))).json();assert.equal(preview.created,1);assert.equal(preview.skipped,1);assert.equal(preview.updated,0);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,1);const duplicates=await(await api.POST(req({rows:[rows[0],rows[0]]}))).json();assert.equal(duplicates.created,0);assert.equal(duplicates.skipped,2);assert.equal((await api.POST(req({rows}))).status,200);assert.equal((await api.POST(req({rows}))).status,200);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,2);assert.equal(x.sql.prepare("SELECT phone FROM attorneys WHERE bar_number='100001'").get().phone,'5551234');const p=x.sql.prepare("SELECT * FROM attorney_profiles WHERE bar_number='100001'").get();assert.equal(p.owner_id,'owner');assert.equal(p.bio,'Keep my bio');assert.equal(p.photo_key,'attorneys/100001/photo.jpg');assert.equal(p.practice_areas,'');assert.equal(x.sql.prepare("SELECT name FROM attorneys WHERE bar_number='100001'").get().name,'Existing Attorney');const again=await(await api.POST(req({rows}))).json();assert.equal(again.created,0);assert.equal(again.skipped,2);const search=await x.load('app/api/attorneys/route.ts');assert.equal((await(await search.GET(new Request('https://lawvetter.test/api/attorneys?q=Florida%20Attorney'))).json()).total,1);
 const bad=request({rows},'admin','admin@example.test');bad.headers.delete('Origin');assert.equal((await api.POST(bad)).status,403);
});
test('Admin records require owner session, preserve private fields and show firm edits publicly',async()=>{
 const x=await runtime();x.seed('100001','Attorney','Old Firm');const api=await x.load('app/api/admin/records/route.ts');assert.equal((await api.GET(new Request('https://lawvetter.test/api/admin/records'))).status,401);assert.equal((await api.POST(request({kind:'firms',record:{key:'oldfirm',name:'Updated Firm',website:'https://example.test'}},'admin','admin@example.test'))).status,200);assert.equal(x.sql.prepare("SELECT company FROM attorneys WHERE bar_number='100001'").get().company,'Updated Firm');const publicApi=await x.load('app/api/attorneys/route.ts');const result=await(await publicApi.GET(new Request('https://lawvetter.test/api/attorneys?firm=Updated%20Firm'))).json();assert.equal(result.firm.website,'https://example.test');assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM admin_audit').get().n,1);
});
test('Daily visitor tracking deduplicates browsers, counts periods and excludes private pages through the client',async()=>{
 const x=await runtime();const tracker=await x.load('app/api/inquiry-metrics/route.ts');const visit=()=>new Request('https://lawvetter.test/api/inquiry-metrics',{method:'POST',headers:{Origin:'https://lawvetter.test','User-Agent':'Browser'},body:JSON.stringify({visitorId:'12345678-1234-4123-8123-123456789012'})});assert.equal((await tracker.POST(visit())).status,204);assert.equal((await tracker.POST(visit())).status,204);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM site_visits').get().n,1);const overview=await x.load('app/api/admin/overview/route.ts');assert.equal((await overview.GET(new Request('https://lawvetter.test/api/admin/overview'))).status,401);const result=await(await overview.GET(new Request('https://lawvetter.test/api/admin/overview',{headers:{Cookie:adminTestCookie}}))).json();assert.equal(result.visitors.day,1);assert.equal(result.visitors.week,1);assert.equal(result.visitors.month,1);assert.equal(result.visitors.year,1);
});

test('Authenticator algorithm matches RFC 6238 SHA1 vectors and encrypts secrets per owner',async()=>{
 const x=await runtime();x.env.ADMIN_MFA_ENCRYPTION_KEY='cd'.repeat(32);const m=await x.load('db/admin-mfa.ts');const secret=m.base32(Buffer.from('12345678901234567890'));for(const [time,code] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(m.totp(secret,Math.floor(time/30),8),code);const encrypted=m.encryptSecret(secret,'admin@example.test');assert.ok(!encrypted.includes(secret));assert.equal(m.decryptSecret(encrypted,'admin@example.test'),secret);assert.throws(()=>m.decryptSecret(encrypted,'other@example.test'));assert.equal(m.matchingStep(secret,m.totp(secret,5),150000,5),null);assert.equal(m.matchingStep(secret,m.totp(secret,5),150000,4),5);assert.equal(m.matchingStep(secret,m.totp(secret,2),150000,-1),null);
});
test('Authenticator setup requires session, password and valid code, preserves account access until confirmed, and gives hashed recovery codes',async()=>{
 const x=await runtime();x.env.ADMIN_MFA_ENCRYPTION_KEY='cd'.repeat(32);const auth=await x.load('db/client-auth.ts');x.sql.prepare('UPDATE admin_credentials SET password_hash=?').run(auth.hashPassword('Unique administrator password'));const api=await x.load('app/api/admin/mfa/route.ts'),m=await x.load('db/admin-mfa.ts');const req=d=>request({...d,password:'Unique administrator password'},'admin','admin@example.test');assert.equal((await api.POST(request({action:'begin',password:'Unique administrator password'},''))).status,401);assert.equal((await api.POST(request({action:'begin',password:'wrong'},'admin','admin@example.test'))).status,401);const begin=await(await api.POST(req({action:'begin'}))).json();assert.match(begin.uri,/^otpauth:\/\/totp\/LawVetter/);const stored=x.sql.prepare('SELECT * FROM admin_mfa').get();assert.equal(stored.enabled,0);assert.ok(!stored.pending_secret.includes(begin.secret));const code=m.totp(begin.secret,Math.floor(Date.now()/30000));const confirmed=await api.POST(req({action:'confirm',code}));assert.equal(confirmed.status,200);const data=await confirmed.json();assert.equal(data.recoveryCodes.length,10);assert.equal(x.sql.prepare('SELECT enabled FROM admin_mfa').get().enabled,1);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM admin_recovery_codes').get().n,10);assert.ok(!x.sql.prepare('SELECT code_hash FROM admin_recovery_codes').get().code_hash.includes(data.recoveryCodes[0]));assert.equal((await api.POST(req({action:'confirm',code}))).status,400);assert.equal((await api.POST(req({action:'begin'}))).status,409);
});
test('Authenticator login rejects reused codes and email bypass, consumes recovery codes once, and survives password reset',async()=>{
 let emailCount=0;const x=await runtime({fetch:async()=>{emailCount++;return Response.json({id:'sent'});}});x.env.ADMIN_MFA_ENCRYPTION_KEY='cd'.repeat(32);x.env.RESEND_API_KEY='test';x.env.APPROVAL_EMAIL_FROM='from@example.test';const {hashPassword,digest}=await x.load('db/client-auth.ts'),m=await x.load('db/admin-mfa.ts'),secret=m.newSecret(),encrypted=m.encryptSecret(secret,'admin@example.test'),step=Math.floor(Date.now()/30000),codes=m.recoveryCodes();x.sql.prepare('UPDATE admin_credentials SET password_hash=?').run(hashPassword('Unique administrator password'));x.sql.prepare('INSERT INTO admin_mfa(email,secret,enabled,last_step,updated_at) VALUES(?,?,1,?,?)').run('admin@example.test',encrypted,step-1,'2026-01-01');for(const c of codes)x.sql.prepare('INSERT INTO admin_recovery_codes(code_hash,email) VALUES(?,?)').run(m.recoveryHash(c),'admin@example.test');const api=await x.load('app/api/admin/auth/route.ts'),req=d=>request(d,''),login=async(password='Unique administrator password')=>{const r=await api.POST(req({action:'login',email:'admin@example.test',password}));assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);const d=await r.json();assert.equal(d.method,'totp');return d.challenge;};let challenge=await login();const code=m.totp(secret,step);assert.equal((await api.POST(req({action:'verify',challenge,code}))).status,200);challenge=await login();assert.equal((await api.POST(req({action:'verify',challenge,code}))).status,401);assert.equal((await api.POST(req({action:'verify',challenge,code:codes[0]}))).status,200);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM admin_recovery_codes').get().n,9);challenge=await login();assert.equal((await api.POST(req({action:'verify',challenge,code:codes[0]}))).status,401);assert.equal(emailCount,0);
 x.sql.exec('DELETE FROM client_auth_limits');const fake='aa'.repeat(32);x.sql.prepare('INSERT INTO admin_challenges(token_hash,email,code_hash,expires_at) VALUES(?,?,?,?)').run(digest(fake),'admin@example.test',digest(fake+':123456'),Date.now()+600000);assert.equal((await api.POST(req({action:'verify',challenge:fake,code:'123456'}))).status,401);const reset='bb'.repeat(32);x.sql.prepare('INSERT INTO admin_password_tokens(token_hash,email,expires_at) VALUES(?,?,?)').run(digest(reset),'admin@example.test',Date.now()+600000);assert.equal((await api.POST(req({action:'reset',token:reset,password:'Another unique admin password'}))).status,200);assert.equal(x.sql.prepare('SELECT enabled FROM admin_mfa').get().enabled,1);await login('Another unique admin password');assert.equal(emailCount,0);
});
test('Column mapping recognizes annotated spreadsheet headers and prevents default duplicate assignments',async()=>{
 const x=await runtime(),m=await x.load('app/admin/import/import-columns.ts');assert.deepEqual(Array.from(m.initialMapping(['Attorney name','Law firm name','Official URL','Mailing Street','Mailing City','Mailing State/Province','ZIP code','Work Email','County of Official Address','Date Admitted to The Florida Bar','Membership status','Practice Category'])),['name','company','sourceUrl','address','city','state','zip','email','county','admitDate','status','practiceAreas']);assert.equal(m.guessImportColumn('company (law firm name)'),'company');assert.equal(m.guessImportColumn('website (law firm)'),'firmWebsite');assert.equal(m.guessImportColumn('profile_photo_filename'),'photoFilename');assert.equal(m.guessImportColumn('practice_areas'),'practiceAreas');assert.deepEqual(Array.from(m.initialMapping(['phone','phone_number','company (law firm name)','website (law firm)','profile_photo_filename'])),['phone','','company','firmWebsite','photoFilename']);
});
test('Public records and charts reflect administrator edits without granting a claimed badge',async()=>{
 const x=await runtime();x.seed('100001','Old Attorney','Old Firm');x.sql.prepare("UPDATE attorneys SET license_number='100001' WHERE bar_number='100001'").run();const editor=await x.load('app/api/admin/records/route.ts');const record={barNumber:'100001',state:'GA',name:'Updated Attorney',company:'New Firm',phone:'5559876543',email:'updated@example.test',address:'New Address',city:'Miami',practiceAreas:'Immigration',headline:'Updated Headline',bio:'Updated biography',website:'https://example.test/attorney',photoKey:'https://example.test/updated.jpg'};assert.equal((await editor.POST(request({kind:'attorneys',record},'admin','admin@example.test'))).status,200);const search=await x.load('app/api/attorneys/route.ts');const publicResult=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?id=100001'))).json();assert.equal(publicResult.attorney.name,'Updated Attorney');assert.equal(publicResult.attorney.company,'New Firm');assert.equal(publicResult.attorney.owner_edited,1);const profiles=await x.load('app/api/profiles/route.ts'),profile=await(await profiles.POST(request({action:'view',bar:'100001'},''))).json();assert.equal(profile.profile.bio,record.bio);assert.equal(profile.profile.practice_areas,record.practiceAreas);assert.equal(profile.profile.claimed_at,'');assert.equal(profile.isOwner,false);const result=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?practice=immigration'))).json();assert.equal(result.total,1);
});
test('Bing and Apple crawl rules allow public pages but exclude private paths for every named agent',async()=>{
 const x=await runtime(),robots=await x.load('app/robots.txt/route.ts'),text=await(await robots.GET()).text();for(const agent of ['*','bingbot','Applebot','Applebot-Extended']){const group=text.split('User-agent: '+agent+'\n')[1]?.split('\n\n')[0];assert.ok(group);assert.match(group,/Allow: \/\n/);assert.match(group,/Disallow: \/admin\n/);assert.match(group,/Disallow: \/account\/\n/);assert.doesNotMatch(group,/Disallow: \/account\n/);assert.match(group,/Disallow: \/api\//);}assert.match(text,/Sitemap:/);
});

test('Prefixed Florida spreadsheet licenses normalize, skip existing records, and report conflicting states with row numbers',async()=>{
 const x=await runtime(),api=await x.load('app/api/admin/spreadsheet/route.ts'),identity=await x.load('app/attorney-identity.ts');assert.equal(identity.normalizeBarNumber('FL','FL-123473'),'123473');assert.equal(identity.normalizeBarNumber('FL','fl:123473'),'123473');assert.equal(identity.normalizeBarNumber('GA','GA-4170'),'004170');assert.throws(()=>identity.normalizeBarNumber('GA','FL-123473'));const row={status:'Member in Good Standing',city:'Atlanta',barNumber:'FL-123473',name:'Example Florida Attorney',state:'Fl',photoKey:'https://example.test/photo.jpg',status:'Member in Good Standing',company:'Example Firm',sourceUrl:'https://www.floridabar.org/mybarprofile/123473'};const req=d=>request(d,'admin','admin@example.test');assert.equal((await api.POST(req({rows:[row],preview:true}))).status,200);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,0);assert.equal((await api.POST(req({rows:[row]}))).status,200);assert.equal((await api.POST(req({rows:[{...row,barNumber:'123473',name:'Updated Florida Attorney'}]}))).status,200);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorneys').get().n,1);assert.equal(x.sql.prepare('SELECT name FROM attorneys').get().name,'Example Florida Attorney');const skipped=await(await api.POST(req({rows:[row,{...row,barNumber:'123473'}]}))).json();assert.equal(skipped.created,0);assert.equal(skipped.skipped,2);const bad=await api.POST(req({rows:[{...row,state:'GA'}],rowOffset:102}));assert.equal(bad.status,400);assert.match((await bad.json()).error,/Excel row 102: Bar-number prefix/);
});

test('Compact attorney card names use the last name and preserve suffixes and surname particles',async()=>{const x=await runtime(),{attorneyDisplayName}=await x.load('app/attorney-name.ts');for(const [full,display] of [['Jenine Tarik Abdeljaber','Jenine Abdeljaber'],['Abigail Marie Herrmann Ingram','Abigail Ingram'],['Kurt Dominic Jones Jr.','Kurt Jones Jr.'],['A. Christina Toumbakis','A. Toumbakis'],['Maria Isabel de la Cruz','Maria de la Cruz'],['Smith, John Robert','John Smith'],['John Smith','John Smith']])assert.equal(attorneyDisplayName(full),display);});
test('Administrator photo upload creates an unclaimed profile, persists the image, and exposes it publicly',async()=>{const x=await runtime();x.seed('100001','Example Attorney');const api=await x.load('app/api/profile-photo/route.ts'),form=new FormData();form.set('bar','100001');form.set('photo',new File([Uint8Array.from([255,216,255,...Array(40).fill(0)])],'portrait.jpg',{type:'image/jpeg'}));const req=new Request('https://lawvetter.test/api/profile-photo',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:adminTestCookie},body:form});const response=await api.POST(req);assert.equal(response.status,200);const profile=x.sql.prepare("SELECT photo_key,owner_id,claimed_at FROM attorney_profiles WHERE bar_number='100001'").get();assert.match(profile.photo_key,/^attorneys\/100001\//);assert.equal(profile.claimed_at,'');assert.equal(profile.owner_id,'');const publicPhoto=await api.GET(new Request('https://lawvetter.test/api/profile-photo?bar=100001'));assert.equal(publicPhoto.status,200);assert.equal(publicPhoto.headers.get('content-type'),'image/jpeg');});


test('Contact and account CAPTCHA fail closed on expired, replayed, wrong-action, and incomplete configuration',async()=>{
 const used=new Set(),x=await runtime({fetch:async(_,opts)=>{const d=JSON.parse(opts.body);if(used.has(d.response)||d.response==='expired')return Response.json({success:false});used.add(d.response);return Response.json({success:true,hostname:'lawvetter.test',action:d.response.startsWith('account')?'account_auth':'directory_submission'});}});x.env.TURNSTILE_SITE_KEY='site';x.env.TURNSTILE_SECRET_KEY='secret';
 const leads=await x.load('app/api/leads/route.ts'),auth=await x.load('app/api/client-auth/route.ts');
 const data={id:'12345678-1234-4123-8123-123456789012',name:'Test Client',email:'client@example.test',city:'Atlanta, GA',practice:'family-law',summary:'I need help with a family law matter.',contactMethod:'email',consent:true};
 for(const captchaToken of [undefined,'expired','account-wrong-action'])assert.equal((await leads.POST(request({...data,captchaToken},''))).status,400);
 assert.equal((await leads.POST(request({...data,captchaToken:'lead-good'},''))).status,201);assert.equal((await leads.POST(request({...data,id:'22345678-1234-4123-8123-123456789012',captchaToken:'lead-good'},''))).status,400);
 const account={action:'register',firstName:'Test',lastName:'Client',email:'new@example.test',password:'secure account password',consent:true};
 assert.equal((await auth.POST(request(account,''))).status,400);assert.equal((await auth.POST(request({...account,captchaToken:'lead-wrong-action'},''))).status,400);assert.equal((await auth.POST(request({...account,captchaToken:'account-good'},''))).status,201);assert.equal((await auth.POST(request({...account,action:'login',captchaToken:'account-good'},''))).status,400);
 delete x.env.TURNSTILE_SECRET_KEY;assert.equal((await auth.POST(request({...account,action:'login',captchaToken:'account-new'},''))).status,400);assert.equal((await leads.POST(request({...data,id:'32345678-1234-4123-8123-123456789012',captchaToken:'lead-new'},''))).status,400);
});

test('Public form fields reject executable markup and invalid types while SQL punctuation stays literal',async()=>{
 const x=await runtime(),api=await x.load('app/api/leads/route.ts'),listing=await x.load('app/api/directory-submissions/route.ts');const data={id:'12345678-1234-4123-8123-123456789012',name:"O'Brien",email:'client@example.test',city:'Atlanta, GA',practice:'family-law',summary:"My case refers to '); DROP TABLE attorneys; -- and I need advice.",contactMethod:'email',consent:true};
 for(const name of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>',{value:'Test'},'Test\u0000Client'])assert.equal((await api.POST(request({...data,name},''))).status,400);
 assert.equal((await api.POST(request(data,''))).status,201);assert.equal(x.sql.prepare('SELECT summary FROM client_leads').get().summary,data.summary);assert.ok(x.sql.prepare('SELECT count(*) n FROM attorneys').get());
 assert.equal((await listing.POST(request({status:'Member in Good Standing',city:'Atlanta',action:'submit',kind:'lawyer',practiceAreas:'Family law',name:'<svg onload=alert(1)>',state:'GA',barNumber:'100010',officialSourceUrl:'https://example.test/licensing',submitterName:'Submitter',submitterEmail:'test@example.test'},''))).status,400);
});


test('City and state suggestions complete both fields and distinguish same-named cities in different states',async()=>{
 const x=await runtime();x.seed('100001','GA Attorney');x.seed('100002','FL Attorney');x.sql.prepare("UPDATE attorneys SET city='Springfield',state='GA' WHERE bar_number='100001'").run();x.sql.prepare("UPDATE attorneys SET city='Springfield',state='FL' WHERE bar_number='100002'").run();const api=await x.load('app/api/cities/route.ts'),get=async q=>(await(await api.GET(new Request('https://lawvetter.test/api/cities?format=locations&q='+encodeURIComponent(q)))).json()).locations;
 assert.ok((await get('Atl')).some(r=>r.label==='Atlanta, GA'));assert.deepEqual((await get('Atlanta, Georgia')).map(r=>r.label),['Atlanta, GA']);assert.ok((await get('Spring')).every(r=>r.city.startsWith('Spring')));assert.ok((await get('Springfield, Illinois')).some(r=>r.label==='Springfield, IL'));assert.deepEqual(await get('A'),[]);assert.deepEqual(await get('%'),[]);assert.deepEqual(await get('Atlanta, INVALID'),[]);assert.deepEqual(await get("'; DROP TABLE attorneys;--"),[]);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,2);
});

test('Situation descriptions require at least eight actual words on the server',async()=>{
 const x=await runtime(),api=await x.load('app/api/leads/route.ts'),{wordCount}=await x.load('app/form-words.ts');assert.equal(wordCount('  one two\nthree four five six seven eight  '),8);assert.equal(wordCount('... !!! --'),0);assert.equal(wordCount("I need help with my landlord's long-term rental"),8);
 const data={id:'12345678-1234-4123-8123-123456789012',name:'Test Client',email:'client@example.test',city:'Atlanta, GA',practice:'family-law',summary:'one two three four five six seven',contactMethod:'email',consent:true};
 const short=await api.POST(request(data,''));assert.equal(short.status,400);assert.match((await short.json()).error,/at least 8 words/);assert.equal((await api.POST(request({...data,summary:'... !!! --'},''))).status,400);assert.equal((await api.POST(request({...data,summary:'one two three four five six seven eight'},''))).status,201);assert.equal(x.sql.prepare('SELECT count(*) n FROM client_leads').get().n,1);
});


test('New practice categories appear automatically, match complete tokens, and support city and ZIP filtering',async()=>{
 const x=await runtime();for(const [bar,name] of [['100001','First Attorney'],['100002','Second Attorney'],['100003','Third Attorney']])x.seed(bar,name);const edit=await x.load('app/api/admin/records/route.ts');
 async function save(bar,areas,city='Miami',zip='33131'){const r=await edit.POST(request({kind:'attorneys',record:{_id:bar,barNumber:bar,state:'GA',name:bar==='100001'?'First Attorney':bar==='100002'?'Second Attorney':'Third Attorney',city,zip,practiceAreas:areas}},'admin','admin@example.test'));assert.equal(r.status,200,JSON.stringify(await r.json()));}
 await save('100001','Intellectual Property; Patent; Family law','Miami','33131-1234');await save('100002','intellectual property, Patent Litigation','Miami','33133');await save('100003','Patent | Employment law','Atlanta','30303');
 const api=await x.load('app/api/attorneys/route.ts'),search=async data=>{const r=await api.POST(request(data,''));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json();};
 const catalog=(await search({categories:'1'})).areas;assert.equal(catalog.filter(a=>a.id==='intellectual-property').length,1);assert.ok(catalog.some(a=>a.id==='patent'));assert.ok(catalog.some(a=>a.id==='patent-litigation'));
 assert.deepEqual((await search({practice:'patent'})).attorneys.map(a=>internalBar(x,a.bar_number)).sort(),['100001','100003']);assert.equal(internalBar(x,(await search({practice:'family-law'})).attorneys[0].bar_number),'100001');assert.equal(internalBar(x,(await search({practice:'employment-law'})).attorneys[0].bar_number),'100003');assert.equal(internalBar(x,(await search({practice:'intellectual-property',city:'Miami',zip:'33131'})).attorneys[0].bar_number),'100001');assert.equal(internalBar(x,(await search({practice:'patent',city:'Atlanta, GA'})).attorneys[0].bar_number),'100003');assert.equal((await search({practice:'patent',zip:'33133',radius:'5'})).total,1);assert.equal((await search({q:'Intellectual Property'})).total,2);assert.equal((await api.POST(request({practice:'patent',zip:'invalid'},''))).status,400);
 const home=await search({home:'1'});assert.ok(home.practiceCategories.some(a=>a.id==='patent'));
 await save('100001','Family law');await save('100003','Employment law');x.advance(60001);assert.equal((await search({categories:'1'})).areas.some(a=>a.id==='patent'),false);assert.equal((await api.POST(request({practice:'patent'},''))).status,400);
});

test('Custom practice categories include every matching attorney across result pages',async()=>{const x=await runtime();for(let i=0;i<31;i++){const bar=String(100000+i);x.seed(bar,'Tax Attorney '+i);x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,claimed_at,updated_at) VALUES(?,'',?,'',?)").run(bar,i%2?'Tax law, Patent':'Tax law','2026-10-13');}const api=await x.load('app/api/attorneys/route.ts'),first=await(await api.POST(request({practice:'tax-law',page:1},''))).json(),second=await(await api.POST(request({practice:'tax-law',page:2},''))).json();assert.equal(first.total,31);assert.equal(first.attorneys.length,24);assert.equal(second.attorneys.length,7);assert.equal(new Set([...first.attorneys,...second.attorneys].map(a=>a.bar_number)).size,31);});


test('Required public CAPTCHA never accepts a submission when provider keys are missing',async()=>{const x=await runtime();x.env.DIRECTORY_CAPTCHA_REQUIRED='true';const api=await x.load('app/api/directory-submissions/route.ts'),leads=await x.load('app/api/leads/route.ts');const config=await(await api.GET()).json();assert.equal(config.captchaRequired,true);assert.equal(config.captchaEnabled,false);const draft={status:'Member in Good Standing',city:'Atlanta',action:'submit',kind:'lawyer',practiceAreas:'Family law',name:'Required CAPTCHA Attorney',state:'GA',barNumber:'100010',officialSourceUrl:'https://example.test/licensing',submitterName:'Test Submitter',submitterEmail:'test@example.test',captchaToken:'invented-token'};const response=await api.POST(request(draft,''));assert.equal(response.status,400);assert.match((await response.json()).error,/verification is currently unavailable/);assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM directory_submissions').get().n,0);const inquiry={id:'12345678-1234-4123-8123-123456789012',name:'Test Client',email:'client@example.test',city:'Atlanta, GA',practice:'family-law',summary:'I need help with a family law matter.',contactMethod:'email',consent:true};assert.equal((await leads.POST(request(inquiry,''))).status,400);assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM client_leads').get().n,0);});

test('Dashboard surfaces public directory submissions and keeps pending counts separate from published records',async()=>{const x=await runtime(),submissions=await x.load('app/api/directory-submissions/route.ts');const items=[];for(let i=0;i<3;i++){const r=await submissions.POST(request({status:'Member in Good Standing',city:'Atlanta',action:'submit',kind:'lawyer',practiceAreas:'Family law',name:'Submitted Attorney '+i,state:'GA',barNumber:'10000'+i,officialSourceUrl:'https://example.test/licensing',submitterName:'Submitter',submitterEmail:'test@example.test'},''));assert.equal(r.status,200);items.push((await r.json()).id);}x.sql.prepare("UPDATE directory_submissions SET status='approved_for_import',submitted_at='2026-10-12T10:00:00Z' WHERE id=?").run(items[1]);x.sql.prepare("UPDATE directory_submissions SET status='published',submitted_at='2026-10-13T12:00:00Z' WHERE id=?").run(items[2]);const overview=await x.load('app/api/admin/overview/route.ts'),requestOverview=new Request('https://lawvetter.test/api/admin/overview',{headers:{Cookie:adminTestCookie}}),data=await(await overview.GET(requestOverview)).json();assert.equal(data.totals.submissions,2);assert.deepEqual(data.directoryQueue.map(r=>r.id),[items[1],items[0],items[2]]);assert.equal(data.directoryQueue[2].status,'published');assert.equal(data.queue.length,0);const queue=await(await submissions.POST(request({action:'list'},'admin','admin@example.test'))).json();assert.deepEqual(queue.submissions.map(r=>r.id),[items[1],items[0],items[2]]);assert.equal((await overview.GET(new Request('https://lawvetter.test/api/admin/overview'))).status,401);});

test('First and last name omit middle names; a misspelled surname offers filtered alternatives without recording a match',async()=>{
 const x=await runtime();x.seed('238455','Brennan John McElhone');x.seed('900123','Brennan Other');x.sql.prepare("UPDATE attorneys SET city='Lawrenceville' WHERE bar_number='238455'").run();x.sql.prepare("UPDATE attorneys SET city='Atlanta' WHERE bar_number='900123'").run();
 const api=await x.load('app/api/attorneys/route.ts');
 for(const q of ['Brennan McElhone','brennan mcelhone','Brennan John McElhone','brennan mc','brennan mce','mc brennan']){const d=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q='+encodeURIComponent(q)))).json();assert.equal(d.total,1);assert.equal(internalBar(x,d.attorneys[0].bar_number),'238455');assert.equal(d.suggestions.length,0);}
 const miss=await(await api.POST(request({q:'brennan mchones',city:'Lawrenceville',eventId:'11111111-1111-4111-8111-111111111111'}))).json();assert.equal(miss.total,0);assert.deepEqual(miss.suggestions.map(a=>internalBar(x,a.bar_number)),['238455']);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorney_search_events').get().n,0);
 const filtered=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=brennan%20mchones&city=Miami'))).json();assert.equal(filtered.suggestions.length,0);
 const wildcard=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=%25%20mchones'))).json();assert.equal(wildcard.suggestions.length,0);
});

test('Administrator directory city and state filters intersect names, paginate, and filter firm membership',async()=>{
 const x=await runtime();for(const [bar,name,firm,city,state] of [['800001','Alice Example','Example Firm','Atlanta','GA'],['800002','Bob Example','Example Firm','Miami','FL'],['800003','Carol Example','Other Firm','Miami','FL']]){x.seed(bar,name,firm);x.sql.prepare('UPDATE attorneys SET city=?,state=? WHERE bar_number=?').run(city,state,bar);}
 const api=await x.load('app/api/admin/records/route.ts'),get=async params=>{const response=await api.GET(new Request('https://lawvetter.test/api/admin/records?'+new URLSearchParams(params),{headers:{Cookie:adminTestCookie}}));assert.equal(response.status,200);return response.json();};
 let d=await get({state:'fl',city:' mIaMi ',q:'Bob'});assert.equal(d.total,1);assert.equal(d.records[0].bar_number,'800002');
 d=await get({state:'Georgia'});assert.equal(d.total,1);assert.equal(d.records[0].bar_number,'800001');
 d=await get({state:'GA',city:'Miami'});assert.equal(d.total,0);d=await get({city:'%'});assert.equal(d.total,0);
 d=await get({kind:'firms',state:'FL',city:'Miami',q:'Example'});assert.equal(d.total,1);assert.equal(d.records[0].attorneys,1);assert.equal(d.records[0].name,'Example Firm');
 x.seed('004170','Randall Mark Kessler','Kessler Firm');x.sql.prepare("UPDATE attorneys SET city='Atlanta',state='GA' WHERE bar_number='004170'").run();
 for(const q of ['Randall M. Kessler','Randall Kessler','Randy Kessler']){const found=await get({q,state:'GA',city:'Atlanta'});assert.equal(found.total,1);assert.equal(found.records[0].bar_number,'004170');}
 for(let i=0;i<51;i++){const bar=String(810000+i);x.seed(bar,'Paged Attorney '+String(i).padStart(2,'0'),'Paged Firm');x.sql.prepare("UPDATE attorneys SET city='Savannah',state='GA' WHERE bar_number=?").run(bar);}
 d=await get({city:'Savannah',state:'GA',page:'1'});assert.equal(d.total,51);assert.equal(d.records.length,1);
 const denied=await api.GET(new Request('https://lawvetter.test/api/admin/records?state=FL&city=Miami'));assert.equal(denied.status,401);
 const invalid=await api.GET(new Request('https://lawvetter.test/api/admin/records?state=wrong',{headers:{Cookie:adminTestCookie}}));assert.equal(invalid.status,400);
});

test('Practice category cards use concise descriptions and the signup choices cover added practice areas',async()=>{
 const x=await runtime(),categories=await x.load('app/practice-category.ts');const areas=categories.practiceAreaChoices();
 for(const name of ['Aviation','Business & Commercial Disputes','Civil Litigation','Commercial Litigation','Consumer','Employment Law','Intellectual Property','International Arbitration','Labor','Litigation & Disputes','Patent','Real Estate','Social Security & Disability','Workers Compensation']){const area=areas.find(a=>a.name===name);assert.ok(area,name);assert.ok(area.description.length>15);assert.doesNotMatch(area.description,/Find attorneys/);}
 const custom=categories.categoryList(['Maritime Law']);assert.equal(custom.find(a=>a.name==='Maritime Law').description,'Maritime Law advice and representation');
});

function deletionRequest(kind,id,options={}){return new Request('https://lawvetter.test/api/admin/records',{method:'DELETE',headers:{Origin:options.origin||'https://lawvetter.test','Content-Type':'application/json',...(options.anonymous?{}:{Cookie:adminTestCookie})},body:JSON.stringify({kind,id,confirm:options.confirm!==false})});}
function seedDeletionDependencies(x,bar){
 const now=new Date().toISOString();
 x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,photo_key,claimed_at,updated_at) VALUES(?,?,?,?,?,?)').run(bar,'owner','Rare deletion category','attorneys/'+bar+'/photo.png',now,now);
 x.sql.prepare('INSERT INTO shortlist(id,user_id,bar_number,created_at) VALUES(?,?,?,?)').run('shortlist','client',bar,now);
 x.sql.prepare('INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,submitted_at) VALUES(?,?,?,?,?,?,?)').run('claim',bar,'owner','owner@example.test','Owner','Evidence',now);
 x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('attorney-event',bar,now);
 x.sql.prepare('INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES(?,?,?,?)').run('client','Existing Client','client@example.test',now);
 x.sql.prepare("INSERT INTO client_verifications(id,user_id,bar_number,legal_name,court,county,docket,relationship_key,status,submitted_at,review_body,published_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run('verification','client',bar,'Client','Court','County','123','relationship','approved',now,'A published review',now,now);
 x.sql.prepare('INSERT INTO client_verification_audit(id,verification_id,actor_id,action,note,created_at) VALUES(?,?,?,?,?,?)').run('audit','verification','owner','approve','Evidence',now);
 x.sql.prepare('INSERT INTO client_approval_emails(verification_id,id,recipient) VALUES(?,?,?)').run('verification','mail','client@example.test');
 for(const table of ['client_verification_request_emails','client_rejection_emails','review_moderation_emails'])x.sql.prepare('INSERT INTO '+table+'(id,verification_id,recipient,payload,created_at) VALUES(?,?,?,?,?)').run('mail','verification','client@example.test','{}',now);
}
test('Attorney deletion requires owner, same origin and confirmation, and propagates through all related records',async()=>{
 const x=await runtime();x.seed('100001','Deleted Attorney','Last Member Firm');x.seed('FL:100001','Different State Attorney','Other Firm');x.sql.prepare("UPDATE attorneys SET state='FL',license_number='100001' WHERE bar_number='FL:100001'").run();seedDeletionDependencies(x,'100001');
 x.sql.prepare('INSERT INTO firm_search_events VALUES(?,?,?,?)').run('firm-event','lastmemberfirm','Last Member Firm',new Date().toISOString());
 const api=await x.load('app/api/admin/records/route.ts');
 assert.equal((await api.DELETE(deletionRequest('attorneys','100001',{anonymous:true}))).status,401);
 assert.equal((await api.DELETE(deletionRequest('attorneys','100001',{origin:'https://other.test'}))).status,403);
 assert.equal((await api.DELETE(deletionRequest('attorneys','100001',{confirm:false}))).status,400);
 assert.equal((await api.DELETE(deletionRequest('unknown','client'))).status,400);
 assert.equal((await api.DELETE(deletionRequest('attorneys','100001'))).status,200);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys WHERE bar_number=?').get('100001').n,0);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys WHERE bar_number=?').get('FL:100001').n,1);
 for(const table of ['attorney_profiles','shortlist','profile_claims','attorney_search_events','client_verifications','client_verification_audit','client_approval_emails','client_verification_request_emails','client_rejection_emails','review_moderation_emails'])assert.equal(x.sql.prepare('SELECT count(*) n FROM '+table).get().n,0,table);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM client_profiles').get().n,1);
 assert.equal((await api.DELETE(deletionRequest('attorneys','100001'))).status,404);
 const search=await x.load('app/api/attorneys/route.ts');assert.equal((await search.GET(new Request('https://lawvetter.test/api/attorneys?id=100001'))).status,404);
 assert.equal((await(await search.GET(new Request('https://lawvetter.test/api/attorneys?q=Deleted'))).json()).total,0);
 const home=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?home=1'))).json();assert.equal(home.weekly.length,0);assert.equal(home.weeklyFirms.length,0);assert.ok(!home.practiceCategories.some(c=>c.id==='rare-deletion-category'));
 const photos=await x.load('app/api/profile-photo/route.ts');assert.equal((await photos.GET(new Request('https://lawvetter.test/api/profile-photo?bar=100001'))).status,404);
 const saver=await x.load('db/admin-records.ts');await assert.rejects(saver.saveAttorney({status:'Member in Good Standing',city:'Atlanta',state:'GA',barNumber:'100001',name:'Reimport Attempt'},'admin'),/deleted/);
 // SQL guard also rejects a stale import that passed preflight before deletion.
 const guard=await x.load('db/directory-deletions.ts');x.sql.prepare("INSERT INTO attorneys(bar_number,source_id,name,status,source_url,imported_at) SELECT '100001','stale','Stale','Active Member in Good Standing','','now' WHERE "+guard.directoryInsertGuard).run('GA:100001','');assert.equal(x.sql.prepare("SELECT count(*) n FROM attorneys WHERE bar_number='100001'").get().n,0);
});
test('Failed deletion rolls back dependent removal and leaves the record intact',async()=>{
 const x=await runtime();x.seed('100001','Preserved Attorney');seedDeletionDependencies(x,'100001');x.sql.exec("CREATE TRIGGER refuse_delete BEFORE DELETE ON attorneys BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
 const api=await x.load('app/api/admin/records/route.ts');assert.equal((await api.DELETE(deletionRequest('attorneys','100001'))).status,503);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM client_verifications').get().n,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorney_profiles').get().n,1);assert.equal(x.sql.prepare("SELECT count(*) n FROM admin_audit WHERE action='attorney-delete'").get().n,0);
});
test('Deleting a firm retains its attorneys, removes public firm results and prevents roster aliases or imports restoring it',async()=>{
 const x=await runtime();x.seed('356082','First Hines Attorney','Hines Law Firm');x.seed('469075','Second Hines Attorney','Law Offices of Matthew C Hines LLC');x.seed('100001','Unrelated Attorney','Other Firm');const now=new Date().toISOString();x.sql.prepare('INSERT INTO firm_search_events VALUES(?,?,?,?)').run('firm-event','hineslawfirm','Hines Law Firm',now);x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('attorney-event','356082',now);x.sql.prepare('INSERT INTO firm_settings(key,website,updated_at) VALUES(?,?,?)').run('hineslawfirm','https://example.test',now);
 const api=await x.load('app/api/admin/records/route.ts');assert.equal((await api.DELETE(deletionRequest('firms','hineslawfirm'))).status,200);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,3);for(const bar of ['356082','469075']){const a=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get(bar);assert.equal(a.company,'');assert.equal(a.owner_edited,1);}
 const search=await x.load('app/api/attorneys/route.ts');for(const name of ['Hines Law Firm','Law Offices of Matthew C Hines LLC','Hines Law'])assert.equal((await search.GET(new Request('https://lawvetter.test/api/attorneys?firm='+encodeURIComponent(name)))).status,404);
 assert.equal((await(await search.GET(new Request('https://lawvetter.test/api/attorneys?kind=firms&q=Hines'))).json()).total,0);const home=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?home=1'))).json();assert.equal(home.weeklyFirms.length,0);assert.equal(home.weekly.length,1);
 const firms=await x.load('db/directory-firm.ts');await assert.rejects(firms.directoryFirmName('Hines Law'),/deleted/);const saver=await x.load('db/admin-records.ts');await assert.rejects(saver.saveAttorney({status:'Member in Good Standing',city:'Atlanta',state:'GA',barNumber:'100001',name:'Unrelated Attorney',company:'Hines Law Firm'},'admin'),/deleted/);
});

test('Practice search combines an optional attorney name with practice, city, state and ZIP without requiring a middle name',async()=>{
 const x=await runtime();for(const [bar,name,areas,city,zip] of [['100001','Alex Morgan Smith','Family law','Atlanta','30303'],['100002','Alex Morgan Smith','Business law','Atlanta','30303'],['100003','Alex Morgan Smith','Family law','Savannah','31401']]){x.seed(bar,name);x.sql.prepare('UPDATE attorneys SET city=?,zip=? WHERE bar_number=?').run(city,zip,bar);x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,claimed_at,updated_at) VALUES(?,?,?,?,?)').run(bar,'owner',areas,'now','now');}
 const api=await x.load('app/api/attorneys/route.ts');const search=async params=>(await api.GET(new Request('https://lawvetter.test/api/attorneys?'+new URLSearchParams(params)))).json();
 const exact=await search({practice:'family-law',q:'Alex Smith',city:'Atlanta, GA',zip:'30303'});assert.equal(exact.total,1);assert.equal(internalBar(x,exact.attorneys[0].bar_number),'100001');
 assert.equal((await search({practice:'family-law',q:'Alex Smith'})).total,2);assert.match((await search({practice:'family-law',q:'Alex Smith',zip:'99999'})).error,/ZIP/);
 x.seed('100004','Jordan Family');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,claimed_at,updated_at) VALUES(?,?,?,?,?)').run('100004','owner','Family law','now','now');x.advance(60001);assert.equal((await search({practice:'family-law',q:'Jordan Family'})).total,1);
});

test('Firm email confirmation uses expiring single-use tokens, private PDF evidence and owner approval',async()=>{
 const sent=[];const x=await runtime({fetch:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sent.push(JSON.parse(options.body));return Response.json({id:'mail-id'});}});x.env.RESEND_API_KEY='fixture-key';x.seed('100001','Verified Attorney');const api=await x.load('app/api/profiles/route.ts');
 const data={action:'claim',bar:'100001',fullName:'Verified Attorney',verification:'My official firm biography and firm email identify me.',attestation:true,firmEmail:'attorney@actual-firm.example.test'};
 assert.equal((await api.POST(request({...data,firmEmail:'person@gmail.com'}))).status,400);
 const form=new FormData();form.set('data',JSON.stringify(data));form.set('photo',new File(['%PDF-1.7\nPrivate bar membership evidence file'],'bar-card.pdf',{type:'application/pdf'}));const submitted=await api.POST(new Request('https://lawvetter.test/api/profiles',{method:'POST',headers:{Origin:'https://lawvetter.test','oai-authenticated-user-id':'attorney-a','oai-authenticated-user-email':'a@example.test'},body:form}));assert.equal(submitted.status,200);assert.equal((await submitted.json()).emailStatus,'accepted');assert.equal(sent.length,1);assert.equal(sent[0].to[0],data.firmEmail);
 const claim=x.sql.prepare('SELECT * FROM profile_claims').get();assert.equal(claim.firm_email_verified_at,null);assert.equal(claim.evidence_type,'application/pdf');assert.equal(x.files.size,1);
 assert.equal((await api.POST(request({action:'review',id:claim.id,decision:'approve',verified:true},'admin','admin@example.test'))).status,400);
 const evidence=await x.load('app/api/claim-evidence/route.ts'),evidenceReq=user=>new Request('https://lawvetter.test/api/claim-evidence?id='+encodeURIComponent(claim.id),{headers:user==='admin'?{Cookie:adminTestCookie}:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'a@example.test'}});
 assert.equal((await evidence.GET(evidenceReq('other'))).status,404);const privateFile=await evidence.GET(evidenceReq('attorney-a'));assert.equal(privateFile.status,200);assert.equal(privateFile.headers.get('Cache-Control'),'private, no-store');assert.match(privateFile.headers.get('Content-Disposition'),/attachment/);assert.equal((await evidence.GET(evidenceReq('admin'))).status,200);
 const token=new URL(sent[0].text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('token');assert.ok(token);assert.notEqual(claim.email_token_hash,token);const confirmation=await x.load('app/api/claim-email/route.ts'),confirm=token=>new Request('https://lawvetter.test/api/claim-email',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify({token})});
 assert.equal((await confirmation.POST(confirm('a'.repeat(64)))).status,400);assert.equal((await confirmation.POST(confirm(token))).status,200);assert.equal((await confirmation.POST(confirm(token))).status,400);
 assert.equal((await api.POST(request({action:'review',id:claim.id,decision:'approve',verified:true},'admin','admin@example.test'))).status,200);assert.equal(x.sql.prepare('SELECT owner_id FROM attorney_profiles').get().owner_id,'attorney-a');
});
test('Resending firm confirmation invalidates the old token',async()=>{
 const sent=[];const x=await runtime({fetch:async(_,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'mail'});}});x.env.RESEND_API_KEY='key';x.seed('100001','Attorney');const api=await x.load('app/api/profiles/route.ts');await api.POST(request({action:'claim',bar:'100001',fullName:'Attorney',verification:'Independent biography evidence from the firm.',firmEmail:'one@firm.example.test',attestation:true}));
 const first=new URL(sent[0].text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('token');x.sql.exec('UPDATE profile_claims SET email_token_expires=1,email_sent_at=0');const confirmation=await x.load('app/api/claim-email/route.ts'),confirm=token=>new Request('https://lawvetter.test/api/claim-email',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify({token})});assert.equal((await api.POST(request({action:'resend-claim-email',bar:'100001'},'other','other@example.test'))).status,404);
 assert.equal((await(await api.POST(request({action:'resend-claim-email',bar:'100001'}))).json()).emailStatus,'accepted');assert.equal((await confirmation.POST(confirm(first))).status,400);const second=new URL(sent[1].text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('token');assert.equal((await confirmation.POST(confirm(second))).status,200);
});
test('Profile views deduplicate events and private analytics report actual ranking without exposing another owner',async()=>{
 const x=await runtime();x.seed('100001','First Attorney');x.seed('100002','Second Attorney');for(const bar of ['100001','100002'])x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run(bar,bar==='100001'?'one':'two','now','now');const now=new Date().toISOString();x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('first','100001',now);for(let i=0;i<2;i++)x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('second'+i,'100002',now);
 const views=await x.load('app/api/profile-views/route.ts'),req=()=>new Request('https://lawvetter.test/api/profile-views',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify({bar:'100001',eventId:'12345678-1234-4123-8123-123456789012'})});assert.equal((await views.POST(req())).status,200);assert.equal((await views.POST(req())).status,200);
 const analytics=await x.load('app/api/account/analytics/route.ts');const data=await(await analytics.GET(request({},'one'))).json();assert.equal(data.profiles.length,1);assert.equal(data.profiles[0].views,1);assert.equal(data.profiles[0].monthlyRank,2);assert.equal((await analytics.GET(request({},'other'))).status,403);
 const editor=await x.load('app/api/admin/records/route.ts');assert.equal((await editor.DELETE(deletionRequest('attorneys','100001'))).status,200);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorney_profile_views').get().n,0);
});
test('Client deletion revokes sessions and removes reviews and claims while retaining attorney records',async()=>{
 const x=await runtime();x.seed('100001','Retained Attorney');seedDeletionDependencies(x,'100001');x.sql.prepare("UPDATE attorney_profiles SET owner_id='client' WHERE bar_number='100001'").run();x.sql.prepare('INSERT INTO client_account_emails VALUES(?,?)').run('client@example.test','client');x.sql.prepare('INSERT INTO client_passwords VALUES(?,?,?)').run('client','password-hash','now');x.sql.prepare('INSERT INTO client_sessions VALUES(?,?,?)').run('token','client',Date.now()+10000);
 const editor=await x.load('app/api/admin/records/route.ts');assert.equal((await editor.DELETE(deletionRequest('clients','client',{anonymous:true}))).status,401);assert.equal((await editor.DELETE(deletionRequest('clients','client'))).status,200);for(const table of ['client_profiles','client_sessions','client_passwords','client_account_emails','client_verifications','client_verification_audit','shortlist'])assert.equal(x.sql.prepare('SELECT count(*) n FROM '+table).get().n,0,table);const retained=x.sql.prepare('SELECT * FROM attorney_profiles').get();assert.equal(retained.owner_id,'');assert.equal(retained.claimed_at,'');assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,1);
});

test('Public cards receive current approved ownership status across search, practice, firm, rankings and shortlist',async()=>{
 const x=await runtime();for(const [bar,name] of [['100001','Approved Attorney'],['100002','Unclaimed Attorney'],['100003','Revoked Attorney']]){x.seed(bar,name);x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('search-'+bar,bar,new Date().toISOString());}
 x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,practice_areas,photo_key) VALUES(?,?,?,?,?,?)').run('100001','attorney-a','now','now','Family law','portrait.jpg');
 x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run('100003','','now','now');
 const api=await x.load('app/api/attorneys/route.ts'),search=async data=>(await(await api.POST(request(data))).json());
 const rows=(await search({q:'Attorney'})).attorneys;assert.equal(rows.find(a=>internalBar(x,a.bar_number)==='100001').ownership_verified,1);for(const bar of ['100002','100003'])assert.equal(rows.find(a=>internalBar(x,a.bar_number)===bar).ownership_verified,0);
 assert.equal((await search({practice:'family-law'})).attorneys[0].ownership_verified,1);assert.equal((await search({firm:'Example Legal LLC'})).attorneys.find(a=>internalBar(x,a.bar_number)==='100001').ownership_verified,1);
 assert.equal((await search({home:'1'})).weekly.find(a=>internalBar(x,a.bar_number)==='100001').ownership_verified,1);
 const auth=await x.load('app/api/client-auth/route.ts'),registration=await auth.POST(request({action:'register',firstName:'Test',lastName:'Client',email:'card-client@example.test',password:'test account password',consent:true},''));assert.equal(registration.status,201);const cookie=registration.headers.get('set-cookie').split(';')[0],clientRequest=action=>new Request('https://lawvetter.test/api/shortlist',{method:'POST',headers:{Cookie:cookie,Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify({action,bar:'100001'})});
 const shortlist=await x.load('app/api/shortlist/route.ts');const saved=await(await shortlist.POST(clientRequest('save'))).json();assert.equal(saved.attorneys[0].ownership_verified,1);assert.equal(saved.attorneys[0].photo_key,(await x.load('app/attorney-photo.ts')).photoRevision('portrait.jpg'));
 x.sql.prepare("UPDATE attorney_profiles SET owner_id='',claimed_at='' WHERE bar_number='100001'").run();x.advance(120001);assert.equal((await search({q:'Approved Attorney'})).attorneys[0].ownership_verified,0);await search({home:'1'});await x.flushBackground();assert.equal((await search({home:'1'})).weekly.find(a=>internalBar(x,a.bar_number)==='100001').ownership_verified,0);assert.equal((await(await shortlist.POST(clientRequest('list'))).json()).attorneys[0].ownership_verified,0);
});

test('Dashboard routing follows the signed-in owner, and an owned profile never becomes a client-review approval',async()=>{
 const x=await runtime();x.seed('4444','Kyle Test');x.seed('100002','Other Attorney');
 const auth=await x.load('app/api/client-auth/route.ts');async function register(email){const response=await auth.POST(request({action:'register',firstName:'Test',lastName:'Account',email,password:'test account password',consent:true},''));assert.equal(response.status,201);return response.headers.get('set-cookie').split(';')[0];}
 const ownerCookie=await register('owner@example.test'),otherCookie=await register('other@example.test'),{clientIdentity}=await x.load('db/client-auth.ts'),{accountDashboardPath}=await x.load('db/account-dashboard.ts');
 const req=cookie=>new Request('https://lawvetter.test/dashboard',{headers:{Cookie:cookie,'oai-authenticated-user-id':'unrelated-platform-user','oai-authenticated-user-email':'owner@example.test'}}),owner=await clientIdentity(req(ownerCookie)),other=await clientIdentity(req(otherCookie));
 assert.equal(await accountDashboardPath(owner),'/client-reviews');assert.equal(await clientIdentity(req('')),null);
 x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run('4444',owner.user,'now','now');
 assert.equal(await accountDashboardPath(owner),'/account');assert.equal(await accountDashboardPath(other),'/client-reviews');
 const profiles=await x.load('app/api/profiles/route.ts');const body=await(await profiles.POST(new Request('https://lawvetter.test/api/profiles',{method:'POST',headers:{Cookie:ownerCookie,Origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify({action:'account',authentication:'password'})}))).json();assert.equal(body.profiles[0].bar_number,'4444');assert.equal(x.sql.prepare('SELECT count(*) n FROM client_verifications').get().n,0);
 x.sql.prepare('INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,submitted_at) VALUES(?,?,?,?,?,?,?,?)').run('pending','100002',other.user,other.email,'Other Attorney','Independent evidence for review','pending','now');assert.equal(await accountDashboardPath(other),'/account');
});

test('Targeted referrals persist contact details and urgency, and only the current approved owner can read or update them',async()=>{
 const x=await runtime();x.seed('4444','Georgia Attorney');x.seed('FL:4444','Florida Attorney');const auth=await x.load('app/api/client-auth/route.ts');async function register(email){const r=await auth.POST(request({action:'register',firstName:'Test',lastName:'Owner',email,password:'test account password',consent:true},''));assert.equal(r.status,201);const cookie=r.headers.get('set-cookie').split(';')[0],identity=await(await auth.GET(new Request('https://lawvetter.test/api/client-auth',{headers:{Cookie:cookie}}))).json();return {cookie,user:identity.client.user};}
 const one=await register('one@example.test'),two=await register('two@example.test');x.sql.prepare('UPDATE attorneys SET public_id=? WHERE bar_number=?').run('a'.repeat(32),'4444');
 const leads=await x.load('app/api/leads/route.ts'),inbox=await x.load('app/api/account/referrals/route.ts');const draft={id:'11111111-1111-4111-8111-111111111111',name:'Client Example',email:'client@example.test',phone:'404-555-0100',city:'Atlanta, GA',practice:'family-law',summary:'How can I arrange custody and support for my child?',contactMethod:'email',consent:true,attorneyBar:'LV'+'a'.repeat(32),urgency:'urgent'};
 assert.equal((await leads.POST(request({...draft,attorneyBar:'LV'+'b'.repeat(32)},''))).status,400);assert.equal(x.sql.prepare('SELECT count(*) n FROM client_leads').get().n,0);assert.equal((await leads.POST(request({...draft,phone:''},''))).status,400);assert.equal((await leads.POST(request({...draft,urgency:'fake'},''))).status,400);assert.equal((await leads.POST(request({...draft,summary:'<script>alert(1)</script>'},''))).status,400);assert.equal((await leads.POST(request(draft,''))).status,201);
 assert.equal((await leads.POST(request({...draft,attorneyBar:'FL:4444'},''))).status,200);assert.equal(x.sql.prepare('SELECT attorney_bar FROM client_leads WHERE id=?').get(draft.id).attorney_bar,'4444');
 assert.equal((await leads.POST(request({...draft,id:'22222222-2222-4222-8222-222222222222',email:'other-client@example.test',attorneyBar:'FL:4444'},''))).status,201);assert.equal((await leads.POST(request({...draft,id:'33333333-3333-4333-8333-333333333333',email:'general@example.test',attorneyBar:''},''))).status,201);
 assert.equal(x.sql.prepare('SELECT attorney_bar FROM client_leads WHERE id=?').get(draft.id).attorney_bar,'4444');
 for(const [bar,owner] of [['4444',one.user],['FL:4444',two.user]])x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run(bar,owner,'now','now');
 const get=(cookie,bar='4444',page=1)=>inbox.GET(new Request('https://lawvetter.test/api/account/referrals?bar='+encodeURIComponent(bar)+'&page='+page,{headers:{Cookie:cookie}})),update=(cookie,body,origin='https://lawvetter.test')=>inbox.POST(new Request('https://lawvetter.test/api/account/referrals',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await get('')).status,401);assert.equal((await get(two.cookie)).status,403);assert.equal((await get(one.cookie,'FL:4444')).status,403);assert.equal((await get(one.cookie,'4444',0)).status,400);
 const response=await get(one.cookie),first=await response.json();assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(first.referrals.length,1);assert.equal(first.referrals[0].name,draft.name);assert.equal(first.referrals[0].email,draft.email);assert.equal(first.referrals[0].phone,draft.phone);assert.equal(first.referrals[0].summary,draft.summary);assert.equal(first.referrals[0].urgency,'urgent');assert.deepEqual(first.metrics,{total:1,unread:1,urgent:1});assert.equal(first.referrals[0].notification_payload,undefined);
 assert.equal((await update(two.cookie,{id:draft.id,action:'read'})).status,404);assert.equal((await update(one.cookie,{id:draft.id,action:'read'},'https://other.test')).status,403);assert.equal((await update(one.cookie,{id:draft.id,action:'status',status:'invalid'})).status,400);assert.equal((await update(one.cookie,{id:draft.id,action:'read'})).status,200);assert.equal((await update(one.cookie,{id:draft.id,action:'status',status:'contacted'})).status,200);
 const reloaded=await(await get(one.cookie)).json();assert.equal(reloaded.metrics.unread,0);assert.equal(reloaded.referrals[0].status,'contacted');assert.ok(reloaded.referrals[0].attorney_read_at);assert.equal((await leads.GET(new Request('https://lawvetter.test/api/leads',{headers:{Cookie:one.cookie}}))).status,403);
 x.sql.prepare("UPDATE attorney_profiles SET owner_id='',claimed_at='' WHERE bar_number='4444'").run();assert.equal((await get(one.cookie)).status,403);assert.equal((await update(one.cookie,{id:draft.id,action:'read'})).status,404);assert.equal((await(await get(one.cookie,'')).json()).referrals.length,0);
});

test('Referral submissions enforce human verification before appearing in any inbox',async()=>{
 const x=await runtime({fetch:async()=>Response.json({success:false})});x.seed('4444','Attorney');x.env.TURNSTILE_SITE_KEY='fixture-site';x.env.TURNSTILE_SECRET_KEY='fixture-secret';x.env.DIRECTORY_CAPTCHA_REQUIRED='true';const leads=await x.load('app/api/leads/route.ts');const draft={id:'44444444-4444-4444-8444-444444444444',name:'Client',email:'client@example.test',phone:'4045550100',city:'Atlanta',practice:'family-law',summary:'I need help with a family law matter.',contactMethod:'email',consent:true,attorneyBar:'4444',urgency:'soon'};
 assert.equal((await leads.POST(request(draft,''))).status,400);assert.equal((await leads.POST(request({...draft,captchaToken:'forged'},''))).status,400);assert.equal(x.sql.prepare('SELECT count(*) n FROM client_leads').get().n,0);
});

test('Full sitemap pages include uncurated attorneys and normalized firms, exclude private pages, and use profile update dates',async()=>{
 const x=await runtime();x.seed('999001','Uncurated Person','Sample & Firm');x.seed('999002','Second Person','Sample & Firm');x.seed('999003','Deceased Person','Inactive Only Firm','Deceased');x.seed('999004','Retired Person','Inactive Only Firm','Retired');x.seed('999005','Suspended Person','Sample & Firm','Suspended');x.seed('FL:17993','Ivette Gonzalez Petkovich','Petkovich Law Firm','Member in Good Standing');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES(?,?,?,?,?)').run('999001','owner','2026-10-14','2026-10-14T00:00:00Z','Public biography');const sitemap=await x.load('db/sitemaps.ts');assert.match(await sitemap.sitemapIndex(),/attorneys-1.xml/);assert.match(await sitemap.sitemapIndex(),/firms-1.xml/);const attorneys=await sitemap.sitemapPage('attorneys-1.xml');assert.match(attorneys,/uncurated-person-lv-[a-f0-9]{32}/);assert.equal((attorneys.match(/<url>/g)||[]).length,3);assert.match(attorneys,/ivette-gonzalez-petkovich-lv-[a-f0-9]{32}/);assert.doesNotMatch(attorneys,/deceased-person|retired-person|suspended-person/);assert.match(attorneys,/<lastmod>2026-10-21<\/lastmod>/);assert.equal(await sitemap.sitemapPage('attorneys-2.xml'),null);const firms=await sitemap.sitemapPage('firms-1.xml');assert.equal((firms.match(/<url>/g)||[]).length,2);const pages=await sitemap.sitemapPage('pages.xml');assert.ok(pages.includes('/client-reviews'));assert.ok(!pages.includes('/admin'));assert.ok(!pages.includes('/dashboard'));assert.match(pages,/\/account</);
});

test('Public rendering includes searchable results and biography without exposing private ownership or verification details',async()=>{
 const x=await runtime();x.seed('100001','Public Attorney','Firm');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,headline,bio,practice_areas) VALUES(?,?,?,?,?,?,?)').run('100001','PRIVATE-OWNER','now','now','Public headline','Public biography','Family law');const data=await x.load('db/public-directory.ts');const result=await data.publicDirectory({practice:'family-law',city:'Atlanta, GA'});assert.equal(result.attorneys[0].name,'Public Attorney');const state=await data.publicProfileState('100001');assert.equal(state.profile.bio,'Public biography');assert.equal(state.profile.owner_id,undefined);assert.equal(state.claim,null);assert.equal(state.isOwner,false);assert.ok(!JSON.stringify(state).includes('PRIVATE-OWNER'));assert.equal((await data.publicReviews('100001')).reviews.length,0);
});

test('Ranked searches count once per anonymous network per target per day, ignore bots and preserve search availability',async()=>{
 const x=await runtime();x.seed('100001','Unique Attorney','Unique Firm');const api=await x.load('app/api/attorneys/route.ts');let n=0;function search(ip='192.0.2.1',agent='Browser',extra={}){return api.POST(new Request('https://lawvetter.test/api/attorneys',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json','cf-connecting-ip':ip,'User-Agent':agent},body:JSON.stringify({q:'Unique Attorney',eventId:'11111111-1111-4111-8111-'+String(++n).padStart(12,'0'),...extra})}));}
 assert.equal((await search()).status,200);assert.equal((await search()).status,200);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorney_search_events').get().n,1);await search('192.0.2.2');assert.equal(x.sql.prepare('SELECT count(*) n FROM attorney_search_events').get().n,2);await search('192.0.2.3','Googlebot');assert.equal(x.sql.prepare('SELECT count(*) n FROM attorney_search_events').get().n,2);await search('192.0.2.1','Browser',{q:'Unique Firm',kind:'firms'});await search('192.0.2.1','Browser',{q:'Unique Firm',kind:'firms'});assert.equal(x.sql.prepare('SELECT count(*) n FROM firm_search_events').get().n,1);assert.equal((await api.POST(new Request('https://lawvetter.test/api/attorneys',{method:'POST',headers:{Origin:'https://other.test'},body:'{}'}))).status,403);
});

test('Attorney referral alerts use the currently approved confirmed firm email, are private and deduplicate retries',async()=>{
 const sent=[];const x=await runtime({fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'receipt'});}});x.env.RESEND_API_KEY='fake-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <alerts@example.test>';x.seed('100001','Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run('100001','owner','now','now');x.sql.prepare('INSERT INTO profile_claims(id,bar_number,user_id,email,full_name,verification,status,submitted_at,firm_email,firm_email_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('claim','100001','owner','private-account@example.test','Attorney','Evidence','approved','now','confirmed@firm.example.test','now');x.sql.prepare('INSERT INTO client_leads(id,name,email,city,practice,summary,contact_method,consent_version,created_at,updated_at,attorney_bar) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('lead','PRIVATE-CLIENT','private-client@example.test','Atlanta','family-law','PRIVATE-QUESTION','email','v2','now','now','100001');const alerts=await x.load('db/referral-notification.ts');assert.equal(await alerts.notifyAttorney('lead'),'accepted');assert.equal(await alerts.notifyAttorney('lead'),'accepted');assert.equal(sent.length,1);assert.equal(sent[0].to[0],'confirmed@firm.example.test');assert.ok(sent[0].text.includes('/account?bar=100001#attorney-referrals'));assert.ok(!JSON.stringify(sent[0]).includes('PRIVATE-CLIENT'));assert.ok(!JSON.stringify(sent[0]).includes('PRIVATE-QUESTION'));x.sql.prepare("UPDATE attorney_profiles SET owner_id='',claimed_at='' WHERE bar_number='100001'").run();assert.equal(await alerts.notifyAttorney('lead'),'professional-email-needed');assert.equal(sent.length,1);
});

test('Launch settings require admin identity, validate Analytics IDs and refuse an unconnected canonical domain',async()=>{
 const x=await runtime({fetch:async()=>Response.json({projectId:'another-site'})}),api=await x.load('app/api/admin/launch/route.ts');assert.equal((await api.GET(request({},''))).status,401);assert.equal((await api.POST(request({origin:'https://lawvetter.com',gaMeasurementId:'G-ABCDE12345'},'admin','admin@example.test'))).status,400);assert.equal((await api.POST(request({origin:'https://www.lawvetter.com',gaMeasurementId:'bad'},'admin','admin@example.test'))).status,400);assert.equal((await api.POST(request({origin:'https://www.lawvetter.com',gaMeasurementId:'G-ABCDE12345'},'admin','admin@example.test'))).status,200);const settings=await x.load('db/site-settings.ts');assert.equal((await settings.publicSettings()).gaMeasurementId,'G-ABCDE12345');assert.equal((await api.GET(request({},'admin','admin@example.test'))).status,200);
});

test('Encrypted backup preserves records, private evidence and runtime settings, rejects tampering, and restores in an isolated directory',async()=>{
 const x=await runtime();x.seed('100001','Backup Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES(?,?,?,?,?)').run('100001','owner','now','now','Restored biography');x.env.ADMIN_MFA_ENCRYPTION_KEY='fake-restoration-key';const portrait=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);x.files.set('photos/portrait.png',{body:portrait,httpMetadata:{contentType:'image/png'}});const bucket=x.env.PROFILE_PHOTOS;bucket.get=async key=>{const f=x.files.get(key);return f?{...f,arrayBuffer:async()=>Uint8Array.from(f.body).buffer}:null;};bucket.list=async({prefix=''}={})=>({objects:[...x.files].filter(([k])=>k.startsWith(prefix)).map(([key,f])=>({key,size:f.body.length,uploaded:new Date()})),truncated:false});bucket.createMultipartUpload=async key=>{const chunks=[];return {uploadPart:async(partNumber,body)=>{chunks.push(body);return {partNumber,etag:'part-'+partNumber};},complete:async()=>{x.files.set(key,{body:Buffer.concat(chunks.map(b=>Buffer.from(b)))});},abort:async()=>{}};};
 const backup=await x.load('db/site-backup.ts'),format=await x.load('db/backup-format.ts'),passphrase='a separate strong test passphrase',result=await backup.createSiteBackup(passphrase),text=Buffer.from(x.files.get(result.key).body).toString();assert.ok(!text.includes('Restored biography'));assert.ok(!text.includes('fake-restoration-key'));const decoded=await format.decryptBackup(text,passphrase);assert.equal(decoded.records.find(r=>r.kind==='rows'&&r.table==='attorney_profiles').rows[0].bio,'Restored biography');assert.equal(decoded.records.find(r=>r.kind==='runtime').values.ADMIN_MFA_ENCRYPTION_KEY,'fake-restoration-key');assert.equal(decoded.records.find(r=>r.kind==='object').key,'photos/portrait.png');assert.ok(!decoded.records.some(r=>r.table==='admin_sessions'));
 await assert.rejects(()=>format.decryptBackup(text,'wrong passphrase'));await assert.rejects(()=>format.decryptBackup(text.trim().split('\n').slice(0,-1).join('\n'),passphrase));const lines=text.trim().split('\n'),part=JSON.parse(lines[1]);part.cipher=(part.cipher[0]==='A'?'B':'A')+part.cipher.slice(1);lines[1]=JSON.stringify(part);await assert.rejects(()=>format.decryptBackup(lines.join('\n'),passphrase));
 const os=await import('node:os'),cp=await import('node:child_process'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'lawvetter-restore-')),file=path.join(temp,'encrypted.lvbackup'),target=path.join(temp,'restored');try{fs.writeFileSync(file,text);cp.execFileSync(process.execPath,['scripts/restore-backup.mjs',file,target],{input:passphrase+'\n',stdio:['pipe','pipe','pipe']});const restored=new DatabaseSync(path.join(target,'data.sqlite'));assert.equal(restored.prepare('SELECT name FROM attorneys').get().name,'Backup Attorney');assert.equal(restored.prepare('SELECT bio FROM attorney_profiles').get().bio,'Restored biography');assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length,0);restored.close();assert.deepEqual(new Uint8Array(fs.readFileSync(path.join(target,'objects/photos/portrait.png'))),portrait);assert.equal(JSON.parse(fs.readFileSync(path.join(target,'runtime-settings.json'))).ADMIN_MFA_ENCRYPTION_KEY,'fake-restoration-key');}finally{fs.rmSync(temp,{recursive:true,force:true});}
 const api=await x.load('app/api/admin/backups/route.ts');assert.equal((await api.GET(request({},''))).status,401);assert.equal((await api.POST(request({password:'wrong',passphrase},''))).status,401);
});

test('Deceased cleanup removes only deceased records atomically and prevents their reimport',async()=>{
 const x=await runtime();x.seed('100001','Deceased Attorney','Shared Firm','Deceased');x.seed('100002','Active Attorney','Shared Firm');x.seed('100003','Retired Attorney','Retired Firm','Retired');
 x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES('100001','','','','Old biography')").run();
 x.sql.prepare("INSERT INTO attorney_search_events(event_id,bar_number,created_at) VALUES('dead-event','100001','2026-10-14')").run();
 const api=await x.load('app/api/admin/deceased-cleanup/route.ts');const req=(cookie='',origin='https://lawvetter.test',confirm='REMOVE DECEASED ATTORNEYS')=>new Request('https://lawvetter.test/api/admin/deceased-cleanup',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm})});
 assert.equal((await api.POST(req())).status,401);assert.equal((await api.POST(req(adminTestCookie,'https://evil.test'))).status,403);assert.equal((await api.POST(req(adminTestCookie,'https://lawvetter.test','wrong'))).status,400);
 const result=await(await api.POST(req(adminTestCookie))).json();assert.equal(result.removed,1);assert.equal(result.remaining,0);assert.equal(x.sql.prepare("SELECT count(*) AS n FROM attorneys").get().n,2);assert.equal(x.sql.prepare("SELECT count(*) AS n FROM attorney_profiles").get().n,0);assert.equal(x.sql.prepare("SELECT count(*) AS n FROM attorney_search_events").get().n,0);assert.equal(x.sql.prepare("SELECT record_id FROM admin_audit WHERE action='attorney-delete'").get().record_id,'GA:100001');
 const records=await x.load('db/admin-records.ts');await assert.rejects(records.saveAttorney({status:'Member in Good Standing',city:'Atlanta',state:'GA',barNumber:'100001',name:'Reimport',status:'Active Member in Good Standing'},'admin@example.test'),/deleted/);await assert.rejects(records.saveAttorney({status:'Member in Good Standing',city:'Atlanta',state:'GA',barNumber:'100004',name:'Another deceased',status:'Deceased'},'admin@example.test'),/verified active members/);
 assert.equal((await(await api.POST(req(adminTestCookie))).json()).removed,0);
 x.seed('100005','Rollback Attorney','Firm','Deceased');x.sql.exec("CREATE TRIGGER fail_cleanup BEFORE DELETE ON attorneys BEGIN SELECT RAISE(ABORT,'test rollback'); END");const cleanup=await x.load('db/deceased-cleanup.ts');await assert.rejects(cleanup.removeDeceasedBatch('admin@example.test'));assert.ok(x.sql.prepare("SELECT 1 FROM attorneys WHERE bar_number='100005'").get());assert.equal(x.sql.prepare("SELECT count(*) AS n FROM admin_audit WHERE record_id='GA:100005'").get().n,0);
});

test('Spreadsheet repeats within a new batch add once and concurrent insert guards never overwrite an existing profile',async()=>{
 const x=await runtime(),api=await x.load('app/api/admin/spreadsheet/route.ts'),row={status:'Member in Good Standing',city:'Atlanta',state:'FL',barNumber:'FL-123473',name:'New Attorney',company:'New Firm',photoKey:'https://example.test/photo.jpg',practiceAreas:'Family law',firmWebsite:'https://new.test'};
 const req=d=>request(d,'admin','admin@example.test');const preview=await(await api.POST(req({rows:[row,{...row,barNumber:'123473'}],preview:true}))).json();assert.equal(preview.created,1);assert.equal(preview.skipped,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,0);
 const saved=await(await api.POST(req({rows:[row,{...row,barNumber:'123473',name:'Duplicate Name'}]}))).json();assert.equal(saved.created,1);assert.equal(saved.skipped,1);assert.equal(x.sql.prepare('SELECT name FROM attorneys').get().name,'New Attorney');assert.equal(x.sql.prepare('SELECT count(*) n FROM admin_audit').get().n,1);
 // Insert another importer’s record after the existence check, before this batch executes.
 const saver=await x.load('db/admin-records.ts'),db=x.env.DB,originalBatch=db.batch;db.batch=async statements=>{x.seed('FL:987654','Concurrent Attorney','Original Firm');x.sql.prepare("UPDATE attorneys SET state='FL',license_number='987654' WHERE bar_number='FL:987654'").run();x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio,photo_key) VALUES('FL:987654','owner','before','before','Original bio','original.jpg')").run();return originalBatch(statements);};
 const raced=await saver.saveAttorney({status:'Member in Good Standing',city:'Atlanta',state:'FL',barNumber:'987654',name:'Overwritten',company:'Overwrite Firm',bio:'Overwrite bio',photoKey:'https://new.test/photo.jpg',firmWebsite:'https://overwrite.test'},'admin@example.test',true,true);assert.equal(raced.skipped,true);assert.equal(x.sql.prepare("SELECT name FROM attorneys WHERE bar_number='FL:987654'").get().name,'Concurrent Attorney');assert.equal(x.sql.prepare("SELECT bio FROM attorney_profiles WHERE bar_number='FL:987654'").get().bio,'Original bio');assert.equal(x.sql.prepare('SELECT count(*) n FROM admin_audit').get().n,1);assert.equal(x.sql.prepare("SELECT count(*) n FROM firm_settings WHERE website='https://overwrite.test'").get().n,0);
});

test('LinkedIn links persist through admin edits, owner edits, public profiles and firm pages with safe URL validation',async()=>{
 const x=await runtime();x.seed('100001','LinkedIn Attorney','LinkedIn Firm');const records=await x.load('app/api/admin/records/route.ts'),profiles=await x.load('app/api/profiles/route.ts');
 const admin=d=>request(d,'admin','admin@example.test');let response=await records.POST(admin({kind:'attorneys',record:{status:'Member in Good Standing',city:'Atlanta',state:'GA',barNumber:'100001',name:'LinkedIn Attorney',linkedinUrl:'https://linkedin.com/in/example-lawyer?tracking=1'}}));assert.equal(response.status,200);assert.equal(x.sql.prepare('SELECT linkedin_url FROM attorney_profiles').get().linkedin_url,'https://www.linkedin.com/in/example-lawyer/');
 const publicState=await x.load('db/public-directory.ts');assert.equal((await publicState.publicProfileState('100001')).profile.linkedin_url,'https://www.linkedin.com/in/example-lawyer/');assert.equal((await(await profiles.POST(request({action:'view',bar:'100001'},''))).json()).profile.linkedin_url,'https://www.linkedin.com/in/example-lawyer/');
 const listed=await(await records.GET(new Request('https://lawvetter.test/api/admin/records?kind=attorneys',{headers:{Cookie:adminTestCookie}}))).json();assert.equal(listed.records[0].linkedin_url,'https://www.linkedin.com/in/example-lawyer/');
 const owned={action:'save',bar:'100001',headline:'',bio:'',practiceAreas:'',website:'',linkedinUrl:'https://www.linkedin.com/in/owner-lawyer/'};assert.equal((await profiles.POST(request(owned,'someone-else'))).status,403);x.sql.prepare("UPDATE attorney_profiles SET owner_id='owner',claimed_at='now'").run();assert.equal((await profiles.POST(request(owned,'owner'))).status,200);assert.equal(x.sql.prepare('SELECT linkedin_url FROM attorney_profiles').get().linkedin_url,owned.linkedinUrl);
 for(const url of ['https://linkedin.com.evil.test/in/example/','javascript:alert(1)','https://www.linkedin.com/company/firm/','https://attacker@www.linkedin.com/in/example/'])assert.equal((await profiles.POST(request({...owned,linkedinUrl:url},'owner'))).status,400);assert.equal((await profiles.POST(request({...owned,linkedinUrl:''},'owner'))).status,200);assert.equal((await publicState.publicProfileState('100001')).profile.linkedin_url,'');
 const firm={kind:'firms',record:{key:'linked infirm'.replace(/ /g,''),name:'LinkedIn Firm',website:'https://example.test',linkedinUrl:'https://linkedin.com/company/example-firm'}};assert.equal((await records.POST(admin(firm))).status,200);const directory=await x.load('app/api/attorneys/route.ts'),firmPage=await(await directory.GET(new Request('https://lawvetter.test/api/attorneys?firm=LinkedIn%20Firm'))).json();assert.equal(firmPage.firm.linkedinUrl,'https://www.linkedin.com/company/example-firm/');assert.equal((await publicState.publicProfileState('100001')).firmLinkedInUrl,firmPage.firm.linkedinUrl);
 assert.equal((await records.POST(admin({...firm,record:{...firm.record,linkedinUrl:'https://www.linkedin.com/in/example/'}}))).status,400);assert.equal((await records.POST(admin({...firm,record:{...firm.record,linkedinUrl:''}}))).status,200);assert.equal((await publicState.publicProfileState('100001')).firmLinkedInUrl,null);const newRecord={kind:'attorneys',record:{status:'Member in Good Standing',city:'Atlanta',_new:1,state:'FL',barNumber:'999001',name:'Added Attorney',linkedinUrl:'https://www.linkedin.com/in/added-attorney/'}};const added=await records.POST(admin(newRecord));assert.equal(added.status,200);assert.equal((await added.json()).id,'FL:999001');assert.equal((await records.POST(admin(newRecord))).status,409);assert.equal((await publicState.publicProfileState('FL:999001')).profile.linkedin_url,newRecord.record.linkedinUrl);
});

test('Spreadsheet imports accept missing photos and practice areas while retaining existing profiles',async()=>{
 const x=await runtime();x.seed('100001','Existing Attorney');const api=await x.load('app/api/admin/spreadsheet/route.ts'),rows=[{status:'Member in Good Standing',city:'Atlanta',name:'Existing Attorney',state:'GA',barNumber:'100001'},{status:'Member in Good Standing',city:'Atlanta',name:'No Photo Attorney',state:'FL',barNumber:'900001'},{status:'Member in Good Standing',city:'Atlanta',name:'Photo Attorney',state:'FL',barNumber:'900002',photoKey:'https://example.test/photo.jpg'}];const req=d=>request(d,'admin','admin@example.test');const preview=await(await api.POST(req({rows,preview:true}))).json();assert.equal(preview.created,2);assert.equal(preview.skipped,1);assert.equal(preview.withoutPhoto,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,1);const saved=await(await api.POST(req({rows}))).json();assert.equal(saved.created,2);assert.equal(saved.skipped,1);assert.equal(saved.withoutPhoto,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,3);assert.equal(x.sql.prepare("SELECT count(*) n FROM attorneys WHERE license_number='900001'").get().n,1);assert.equal(x.sql.prepare("SELECT name FROM attorneys WHERE bar_number='100001'").get().name,'Existing Attorney');const again=await(await api.POST(req({rows}))).json();assert.equal(again.created,0);assert.equal(again.skipped,3);
});

test('Photo-only official imports store matching photos, skip existing licenses, and reject mismatched photos',async()=>{
 let fetched=0;const bytes=new Uint8Array(40);bytes.set([255,216,255,224]);const x=await runtime({fetch:async()=>{fetched++;return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});}});x.env.ATTORNEY_IMPORT_KEY='temporary-test-key';const api=await x.load('app/api/admin/import/route.ts');const row={status:'Member in Good Standing',city:'Atlanta',state:'FL',barNumber:'900010',name:'Photo Attorney',membershipStatus:'Member in Good Standing',eligibility:'Eligible to Practice Law in Florida',sourceUrl:'https://www.floridabar.org/mybarprofile/900010',verifiedBarNumber:'900010',verifiedAt:'2026-10-14T03:00:00Z',admitDate:'2020-10-01',lawSchool:'Example Law School',photoUrl:'https://imageserver.floridabar.org/Images/1/10/0900010p.jpg',company:'Photo Firm'};
 const req=rows=>new Request('https://lawvetter.test/api/admin/import?mode=photo-only',{method:'POST',headers:{Authorization:'Bearer temporary-test-key','Content-Type':'application/json'},body:JSON.stringify(rows)});assert.equal((await api.POST(new Request('https://lawvetter.test/api/admin/import?mode=photo-only',{method:'POST',body:JSON.stringify([row])}))).status,401);
 const wrongLink=await(await api.POST(req([{...row,sourceUrl:'https://www.floridabar.org/mybarprofile/900011'}]))).json();assert.equal(wrongLink.failed,1);const wrongDate=await(await api.POST(req([{...row,admitDate:'2020-02-31'}]))).json();assert.equal(wrongDate.failed,1);
 const incomplete=await(await api.POST(req([{...row,verifiedAt:undefined}]))).json();assert.equal(incomplete.failed,1);assert.equal(fetched,0);assert.equal(x.files.size,0);
 const added=await(await api.POST(req([row]))).json();assert.equal(added.created,1);assert.equal(added.failed,0);assert.equal(x.files.size,1);const profile=x.sql.prepare('SELECT * FROM attorney_profiles').get();assert.equal(profile.practice_areas,'Personal injury');assert.ok(profile.photo_key.startsWith('attorneys/FL:900010/'));assert.ok(x.files.has(profile.photo_key));const again=await(await api.POST(req([{...row,name:'Overwrite'}]))).json();assert.equal(again.duplicates,1);assert.equal(fetched,1);assert.equal(x.sql.prepare('SELECT name FROM attorneys').get().name,row.name);
 const next={...row,barNumber:'900011',sourceUrl:'https://www.floridabar.org/mybarprofile/900011',verifiedBarNumber:'900011'};const noPhoto=await(await api.POST(req([{...next,photoUrl:''}]))).json();assert.equal(noPhoto.withoutPhoto,1);const mismatched=await(await api.POST(req([next]))).json();assert.equal(mismatched.failed,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,1);assert.equal(x.files.size,1);
});

test('Florida member correction verifies identity and fills only missing data on this import',async()=>{
 const x=await runtime(),repair=await x.load('db/florida-member-repair.ts');
 const html='<div id="mProfile"><h1 class="full">Verified Attorney</h1><div class="member-status status-good">Member in Good Standing</div><div class="eligibility eligibility-eligible">Eligible to Practice Law in Florida</div>'+[['Bar Number','900020'],['Personal Bar URL','https://www.floridabar.org/mybarprofile/custom-name'],['Admitted','04/20/1983'],['Law School','Example College of Law, 1981'],['County','Hernando']].map(([k,v])=>'<div class="row"><label>'+k+':</label><p>'+v+'</p></div>').join('')+'</div>';
 const record=repair.parseFloridaMember(html,'900020');assert.equal(record.admitDate,'1983-04-20');assert.equal(record.sourceUrl,'https://www.floridabar.org/mybarprofile/900020');assert.equal(record.publishedSourceUrl,'https://www.floridabar.org/mybarprofile/custom-name');assert.equal(repair.parseFloridaMember(html.replace('custom-name','Name With Spaces'),'900020').publishedSourceUrl,'https://www.floridabar.org/mybarprofile/Name With Spaces');assert.throws(()=>repair.parseFloridaMember(html,'900021'),/does not match/);assert.throws(()=>repair.parseFloridaMember('<h1>Unavailable</h1>','900020'),/unavailable/);
 const original='https://www.floridabar.org/directories/find-mbr/profile/?num=900020';x.seed('FL:900020','Verified Attorney');x.sql.prepare("UPDATE attorneys SET state='FL',license_number='900020',source_url=?,law_school='Existing Owner School' WHERE bar_number='FL:900020'").run(original);x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,photo_key,bio) VALUES(?,?,?,?,?,?)').run('FL:900020','owner','now','now','preserved-photo','Preserved biography');
 assert.equal(await repair.applyFloridaVerification(record,original),false);x.sql.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').run('initial','Florida Bar photo import','attorney-create','FL:900020','now');assert.equal(await repair.applyFloridaVerification(record,original),true);
 const saved=x.sql.prepare("SELECT * FROM attorneys WHERE bar_number='FL:900020'").get();assert.equal(saved.source_url,record.sourceUrl);assert.equal(saved.law_school,'Existing Owner School');assert.equal(saved.admit_date,record.admitDate);const profile=x.sql.prepare('SELECT * FROM attorney_profiles').get();assert.equal(profile.photo_key,'preserved-photo');assert.equal(profile.owner_id,'owner');assert.equal(profile.bio,'Preserved biography');
 x.sql.prepare("UPDATE attorneys SET source_url='https://owner.example/changed' WHERE bar_number='FL:900020'").run();assert.equal(await repair.applyFloridaVerification(record,original),false);assert.equal(x.sql.prepare('SELECT source_url FROM attorneys').get().source_url,'https://owner.example/changed');
});

test('Firm banner and public contacts remain private until approval and publish a searchable standalone firm',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts'),search=await x.load('app/api/attorneys/route.ts'),photos=await x.load('app/api/firm-logo/route.ts');
 const draft={action:'submit',kind:'firm',state:'GA',name:'New Banner Firm',county:'Fulton',city:'Atlanta',website:'https://firm.example.test',officialSourceUrl:'https://firm.example.test/team',submitterName:'Submitter',submitterEmail:'submitter@example.test',address:'123 Main Street',zip:'30301',phone:'404-555-1234',publicEmail:'office@firm.example.test'};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');const form=new FormData();form.set('data',JSON.stringify(draft));form.set('photo',new File([png],'banner.png',{type:'image/png'}));
 const response=await api.POST(new Request('https://lawvetter.test/api/directory-submissions',{method:'POST',headers:{Origin:'https://lawvetter.test'},body:form}));assert.equal(response.status,200);const {id}=await response.json();
 assert.equal((await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Banner%20Firm'))).status,404);
 assert.equal((await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true},'admin','admin@example.test'))).status,200);
 const firmResponse=await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Banner%20Firm'));assert.equal(firmResponse.status,200);const {firm}=await firmResponse.json();assert.equal(firm.address,draft.address);assert.equal(firm.zip,draft.zip);assert.equal(firm.email,draft.publicEmail);assert.equal(firm.phone,draft.phone);assert.equal(firm.total,0);assert.equal(JSON.stringify(firm).includes(draft.submitterEmail),false);
 const results=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?kind=firms&q=New%20Banner%20Firm&city=Atlanta'))).json();assert.equal(results.total,1);assert.equal(results.firms[0].name,draft.name);
 const image=await photos.GET(new Request('https://lawvetter.test/api/firm-logo?key=newbannerfirm'));assert.equal(image.status,200);assert.equal((await image.arrayBuffer()).byteLength,png.length);
});


test('Admin attorney intake saves independent attorney and firm websites and reloads the shared firm website',async()=>{
 const x=await runtime();x.seed('100001','Attorney','Example Firm');const api=await x.load('app/api/admin/records/route.ts');
 const record={status:'Member in Good Standing',city:'Atlanta',barNumber:'100001',state:'GA',name:'Attorney',company:'Example Firm',website:'https://example.test/attorneys/attorney',firmWebsite:'https://example.test/'};
 const save=r=>api.POST(request({kind:'attorneys',record:r},'admin','admin@example.test'));
 assert.equal((await save(record)).status,200);
 assert.equal(x.sql.prepare("SELECT website FROM attorney_profiles WHERE bar_number='100001'").get().website,record.website);
 assert.equal(x.sql.prepare("SELECT website FROM firm_settings WHERE key='examplefirm'").get().website,record.firmWebsite);
 const listed=await(await api.GET(new Request('https://lawvetter.test/api/admin/records',{headers:{Cookie:adminTestCookie}}))).json();assert.equal(listed.records[0].firm_website,record.firmWebsite);assert.equal(listed.records[0].website,record.website);
 const search=await x.load('app/api/attorneys/route.ts');const firm=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=Example%20Firm'))).json();assert.equal(firm.firm.website,record.firmWebsite);
 assert.equal((await save({...record,firmWebsite:''})).status,200);assert.equal(x.sql.prepare("SELECT website FROM firm_settings WHERE key='examplefirm'").get().website,record.firmWebsite);
 assert.equal((await save({...record,company:''})).status,400);
 assert.equal((await save({...record,firmWebsite:'http://example.test'})).status,400);
});


test('Admin firms sort by recently added without moving firms when edited or given another attorney',async()=>{
 const x=await runtime();x.seed('100001','Original Attorney','Original Firm');x.sql.prepare("UPDATE attorneys SET imported_at='2020-01-01T00:00:00Z'").run();
 const api=await x.load('app/api/admin/records/route.ts');
 for(const name of ['Zebra New Firm','Alpha New Firm'])assert.equal((await api.POST(request({kind:'firms',record:{_new:1,name}},'admin','admin@example.test'))).status,200);
 x.sql.prepare("UPDATE admin_audit SET created_at='2026-10-01T00:00:00Z' WHERE record_id='zebranewfirm'").run();x.sql.prepare("UPDATE admin_audit SET created_at='2026-10-02T00:00:00Z' WHERE record_id='alphanewfirm'").run();
 const list=async extra=>(await(await api.GET(new Request('https://lawvetter.test/api/admin/records?kind=firms'+extra,{headers:{Cookie:adminTestCookie}}))).json()).records.map(r=>r.name);
 assert.deepEqual(Array.from(await list('&sort=recent')),['Alpha New Firm','Zebra New Firm','Original Firm']);
 assert.equal((await api.POST(request({kind:'firms',record:{key:'zebranewfirm',name:'Zebra New Firm',website:'https://zebra.test'}},'admin','admin@example.test'))).status,200);
 assert.equal((await api.POST(request({kind:'attorneys',record:{status:'Member in Good Standing',city:'Atlanta',_new:1,name:'Second Attorney',barNumber:'100002',state:'GA',company:'Original Firm'}},'admin','admin@example.test'))).status,200);
 assert.deepEqual(Array.from(await list('&sort=recent')),['Alpha New Firm','Zebra New Firm','Original Firm']);
 assert.deepEqual(Array.from(await list('')),['Alpha New Firm','Original Firm','Zebra New Firm']);
 assert.deepEqual(Array.from(await list('&sort=recent&q=New')),['Alpha New Firm','Zebra New Firm']);
});


test('Admin firm listing handles a large directory and creation audit without repeated audit scans',async t=>{
 const x=await runtime();x.sql.exec('BEGIN');const audit=x.sql.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)');
 for(let i=0;i<5000;i++){const bar=String(200000+i);x.seed(bar,'Attorney '+i,'Firm '+i);audit.run('audit-'+i,'admin@example.test','attorney-create',bar,'2026-01-01');}x.sql.exec('COMMIT');
 const api=await x.load('app/api/admin/records/route.ts'),start=performance.now();for(const sort of ['name','recent']){const response=await api.GET(new Request('https://lawvetter.test/api/admin/records?kind=firms&sort='+sort,{headers:{Cookie:adminTestCookie}}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.total,5000);assert.equal(data.records.length,50);}t.diagnostic('Two firm list sorts over 5,000 firms and audit records: '+Math.round(performance.now()-start)+' ms');
});

test('Firm profile and admin intake inherit an attorney office address and retain an explicit firm address',async()=>{
 const x=await runtime();x.seed('100001','Attorney','Shared Firm');x.sql.prepare("UPDATE attorneys SET address='123 Main Street Suite 4',city='Atlanta',state='GA',zip='30301' WHERE bar_number='100001'").run();
 const records=await x.load('app/api/admin/records/route.ts'),directory=await x.load('app/api/attorneys/route.ts');
 const publicFirm=async()=>(await(await directory.GET(new Request('https://lawvetter.test/api/attorneys?firm=Shared%20Firm'))).json()).firm;
 const adminFirm=async()=>(await(await records.GET(new Request('https://lawvetter.test/api/admin/records?kind=firms&q=Shared',{headers:{Cookie:adminTestCookie}}))).json()).records[0];
 for(const firm of [await publicFirm(),await adminFirm()]){assert.equal(firm.address,'123 Main Street Suite 4');assert.equal(firm.city,'Atlanta');assert.equal(firm.state,'GA');assert.equal(firm.zip,'30301');}
 const save=record=>records.POST(request({kind:'attorneys',record},'admin','admin@example.test'));
 assert.equal((await save({barNumber:'100001',state:'GA',name:'Attorney',company:'Shared Firm',address:'456 Office Way',city:'Decatur',zip:'30030'})).status,200);assert.equal((await publicFirm()).address,'456 Office Way');assert.equal((await adminFirm()).zip,'30030');
 assert.equal((await records.POST(request({kind:'firms',record:{key:'sharedfirm',name:'Shared Firm',address:'789 Headquarters Road',city:'Savannah',state:'GA',zip:'31401'}},'admin','admin@example.test'))).status,200);
 assert.equal((await save({barNumber:'100001',state:'GA',name:'Attorney',company:'Shared Firm',address:'999 New Attorney Office',city:'Atlanta',zip:'30302'})).status,200);
 for(const firm of [await publicFirm(),await adminFirm()]){assert.equal(firm.address,'789 Headquarters Road');assert.equal(firm.city,'Savannah');assert.equal(firm.zip,'31401');}
});


test('Partial names work for admin attorneys, clients, firms and public firm suggestions',async()=>{
 const x=await runtime();x.seed('238455','Brennan John McElhone','Royal & Cross LLC');
 const admin=await x.load('app/api/admin/records/route.ts'),directory=await x.load('app/api/attorneys/route.ts');
 x.sql.prepare("INSERT INTO client_profiles(user_id,legal_name,email,created_at) VALUES(?,?,?,?)").run('partial-client','Alice Mary McDonald','alice@example.test','now');
 const get=async(kind,q)=>{const response=await admin.GET(new Request('https://lawvetter.test/api/admin/records?'+new URLSearchParams({kind,q}),{headers:{Cookie:adminTestCookie}}));assert.equal(response.status,200);return response.json();};
 for(const q of ['brennan mc','MC BRENNAN','brennan  mce']){const result=await get('attorneys',q);assert.equal(result.total,1,q);assert.equal(result.records[0].bar_number,'238455');}
 for(const q of ['alice mc','MC ALICE','alice  mcd']){const result=await get('clients',q);assert.equal(result.total,1,q);assert.equal(result.records[0].user_id,'partial-client');}
 for(const q of ['roy cr','cross roy']){assert.equal((await get('firms',q)).total,1,q);const response=await directory.GET(new Request('https://lawvetter.test/api/attorneys?'+new URLSearchParams({kind:'firms',q})));assert.equal(response.status,200);assert.equal((await response.json()).total,1,q);}
 for(const kind of ['attorneys','firms','clients']){assert.equal((await get(kind,'%')).total,0);assert.equal((await get(kind,'doesnotexist')).total,0);}
});


test('Admin firm roster uses exact normalized membership and exposes every attorney across pages',async()=>{
 const x=await runtime();for(let i=0;i<53;i++){x.seed(String(880000+i),'Roster Attorney '+String(i).padStart(2,'0'),i%2?'Example, Firm LLC':'Example Firm LLC');x.sql.prepare('UPDATE attorneys SET city=?,state=? WHERE bar_number=?').run(i%2?'Miami':'Atlanta',i%2?'FL':'GA',String(880000+i));}
 x.seed('990000','Other Firm Attorney','Example Firm LLC Extra');
 const api=await x.load('app/api/admin/records/route.ts'),get=async params=>{const r=await api.GET(new Request('https://lawvetter.test/api/admin/records?'+new URLSearchParams({kind:'attorneys',...params}),{headers:{Cookie:adminTestCookie}}));assert.equal(r.status,200);return r.json();};
 const first=await get({firmKey:'examplefirmllc'}),second=await get({firmKey:'examplefirmllc',page:'1'});assert.equal(first.total,53);assert.equal(second.total,53);assert.equal(first.records.length,50);assert.equal(second.records.length,3);assert.equal(new Set([...first.records,...second.records].map(a=>a.bar_number)).size,53);assert.ok([...first.records,...second.records].every(a=>a.bar_number!=='990000'));
 assert.equal((await get({firmKey:'unknownfirm'})).total,0);assert.equal((await get({firmKey:'examplefirmllc',state:'FL',q:'Roster Attorney'})).total,26);
 assert.equal((await api.GET(new Request('https://lawvetter.test/api/admin/records?kind=attorneys&firmKey=examplefirmllc'))).status,401);
});


test('Optional middle names persist in account registration and legacy full names retain every word',async()=>{
 const x=await runtime(),api=await x.load('app/api/client-auth/route.ts');
 const data={action:'register',firstName:'Margaret',middleName:'Geneve',lastName:'Clemens',email:'middle@example.test',password:'Strong-password-123',consent:true};
 const response=await api.POST(request(data,''));assert.equal(response.status,201);assert.equal(x.sql.prepare('SELECT legal_name FROM client_profiles WHERE email=?').get(data.email).legal_name,'Margaret Geneve Clemens');
 assert.equal((await api.POST(request({...data,email:'badmiddle@example.test',middleName:'<script>'},''))).status,400);
 const names=await x.load('app/person-name.ts');for(const name of ['Margaret Geneve Gorji','Theodore Scott Eittreim','John de la Cruz','John Michael Smith Jr.','Mary Ann van der Meer']){const parts=names.splitPersonName(name);assert.equal(names.joinPersonName(parts.firstName,parts.middleName,parts.lastName),name);}
 const parts=names.splitPersonName('Margaret Geneve Gorji');assert.equal(parts.firstName,'Margaret');assert.equal(parts.middleName,'Geneve');assert.equal(parts.lastName,'Gorji');
});

test('Admin and public lawyer submissions reject missing locations before writing records',async()=>{
 const x=await runtime(),admin=await x.load('app/api/admin/records/route.ts'),publicApi=await x.load('app/api/directory-submissions/route.ts');
 const record={name:'Location Test',state:'NY',city:'New York',barNumber:'9876542'};
 for(const invalid of [{city:''},{city:'   '},{state:''},{state:'XX'}]){
  const response=await admin.POST(new Request('https://lawvetter.test/api/admin/records',{method:'POST',headers:{origin:'https://lawvetter.test',Cookie:adminTestCookie},body:JSON.stringify({kind:'attorneys',record:{...record,...invalid}})}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/city|state/);
  const submission=await publicApi.POST(request({...record,...invalid,action:'submit',kind:'lawyer',practiceAreas:'Family law',submitterName:'Test Submitter',submitterEmail:'location@example.test',officialSourceUrl:'https://example.test/official'},''));
  assert.equal(submission.status,400);assert.match((await submission.json()).error,/city|state/);
 }
 assert.equal(x.sql.prepare("SELECT COUNT(*) AS n FROM attorneys WHERE name='Location Test'").get().n,0);
 assert.equal(x.sql.prepare("SELECT COUNT(*) AS n FROM directory_submissions WHERE name='Location Test'").get().n,0);
});

test('Banner-only firm settings inherit linked attorney homepages and phones, including beyond the roster page',async()=>{
 const x=await runtime();for(let i=0;i<26;i++)x.seed(String(600000+i),'Attorney '+String(i).padStart(2,'0'));
 x.sql.prepare('UPDATE attorneys SET phone=? WHERE bar_number=?').run('727-609-4588','600025');
 x.sql.prepare("INSERT INTO attorney_profiles(bar_number,website,updated_at,owner_id,claimed_at) VALUES(?,?,?,'','')").run('600025','https://example-firm.test/','2026-10-18');
 x.sql.prepare('INSERT INTO firm_settings(key,banner_key,website,phone,updated_at) VALUES(?,?,?,?,?)').run('examplelegalllc','firms/banner.png','','','2026-10-18');
 const api=await x.load('app/api/attorneys/route.ts');
 const firm=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?firm=Example%20Legal%20LLC'))).json();
 assert.equal(firm.attorneys.length,24);assert.equal(firm.firm.website,'https://example-firm.test/');assert.equal(firm.firm.phone,'727-609-4588');
 const admin=await x.load('app/api/admin/records/route.ts');
 const records=await(await admin.GET(new Request('https://lawvetter.test/api/admin/records?kind=firms',{headers:{Cookie:adminTestCookie}}))).json();
 assert.equal(records.records[0].website,firm.firm.website);assert.equal(records.records[0].phone,firm.firm.phone);
 x.sql.prepare('UPDATE firm_settings SET website=?,phone=?').run('https://explicit-firm.test/','555-111-2222');
 const explicit=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?firm=Example%20Legal%20LLC'))).json();
 assert.equal(explicit.firm.website,'https://explicit-firm.test/');assert.equal(explicit.firm.phone,'555-111-2222');
 x.sql.prepare('UPDATE firm_settings SET website=?,phone=?').run('','');
 x.sql.prepare('UPDATE attorney_profiles SET website=?').run('https://example-firm.test/attorneys/individual');
 const biography=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?firm=Example%20Legal%20LLC'))).json();assert.equal(biography.firm.website,undefined);
 x.sql.prepare('UPDATE attorneys SET company=? WHERE bar_number=?').run('Other Firm','600025');
 const moved=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?firm=Example%20Legal%20LLC'))).json();assert.equal(moved.firm.phone,'');
});

test('Search engine referrals stay private, Google helps ranks, and daily landings deduplicate',async()=>{
 const x=await runtime();x.seed('004170','Randall Mark Kessler');
 const helpers=await x.load('db/search-referrals.ts');
 assert.equal(helpers.searchEngine('https://www.google.com/search?q=lawyer'),'google');
 assert.equal(helpers.searchEngine('https://www.google.co.uk/'),'google');
 assert.equal(helpers.searchEngine('https://www.bing.com/'),'bing');
 for(const ref of ['https://google.com.evil.test/','https://evilgoogle.com/','https://lawvetter.com/','javascript:alert(1)'])assert.equal(helpers.searchEngine(ref),null);
 assert.equal(helpers.referralBar('/lawyers/FL%3A500150-example'),'FL:500150');
 const api=await x.load('app/api/search-referrals/route.ts');
 const visit=(ref='https://www.google.com/',landing='/lawyers/004170-randall-mark-kessler',origin='https://lawvetter.test')=>new Request('https://lawvetter.test/api/search-referrals',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'Mozilla/5.0'},body:JSON.stringify({visitorId:'7b17ba8c-d123-4123-a123-abcdef123456',referrer:ref,landing})});
 assert.equal((await api.POST(visit(undefined,undefined,'https://evil.test'))).status,403);
 assert.equal((await api.POST(visit())).status,204);assert.equal((await api.POST(visit())).status,204);
 assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM search_referral_visits').get().n,1);
 assert.equal((await api.POST(visit('https://www.bing.com/'))).status,204);
 assert.equal((await api.POST(visit('https://www.google.com/','/'))).status,204);
 assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorney_search_events').get().n,0);
 const admin=await x.load('app/api/admin/searches/route.ts');
 assert.equal((await admin.GET(request({},'other','other@example.test'))).status,403);
 const response=await admin.GET(request({},'admin','admin@example.test'));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 const data=await response.json();assert.equal(data.traffic.weekly.google,2);assert.equal(data.traffic.weekly.bing,1);assert.equal(data.traffic.weekly.attorneys[0].google,1);assert.equal(data.traffic.weekly.attorneys[0].bing,1);assert.equal(data.weekly.length,1);assert.equal(data.weekly[0].searches,1);
 const bot=visit();bot.headers.set('User-Agent','Googlebot');await api.POST(bot);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM search_referral_visits').get().n,3);
 const owner=visit();owner.headers.set('Cookie',adminTestCookie);await api.POST(owner);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM search_referral_visits').get().n,3);
});

test('Only active attorneys appear in default search, autocomplete, firm rosters and direct lookups; inactive imports are skipped',async()=>{
 const x=await runtime();x.seed('100001','Active Example');
 for(const [i,status] of ['Inactive Member in Good Standing','Inactive','Suspended','Retired','Disbarred','Deceased','Not independently verified'].entries())x.seed(String(200000+i),'Inactive Example '+i,'Example Legal LLC',status);
 const api=await x.load('app/api/attorneys/route.ts');
 for(const suffix of ['', '?q=Example','?suggest=1&q=Example','?firm=Example%20Legal%20LLC','?statusGroup=all']){const r=await api.GET(new Request('https://lawvetter.test/api/attorneys'+suffix)),data=await r.json();assert.equal(r.status,200);assert.equal(data.attorneys.length,1);assert.equal(data.attorneys[0].name,'Active Example');}
 assert.equal((await api.GET(new Request('https://lawvetter.test/api/attorneys?id=200000'))).status,404);
 const maps=await x.load('db/sitemaps.ts'),xml=await maps.sitemapPage('attorneys-1.xml');assert.ok(xml.includes('active-example'));assert.ok(!xml.includes('inactive-example'));
 x.env.ATTORNEY_IMPORT_KEY='test-key';const importer=await x.load('app/api/admin/import/route.ts'),row={barNumber:'900002',id:'test',name:'Inactive Import',company:'Example Firm',city:'Atlanta',state:'GA',county:'',status:'Inactive Member in Good Standing',admitDate:'',lawSchool:'',address:'',zip:'',phone:'',email:'',sourceUrl:'https://www.gabar.org/member-directory/?id=0123456789abcdef0123456789abcdef',importedAt:'2026-10-21'};
 const r=await importer.POST(new Request('https://lawvetter.test/api/admin/import',{method:'POST',headers:{Authorization:'Bearer test-key','Content-Type':'application/json'},body:JSON.stringify([row])}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{saved:0,skipped:1});assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys WHERE name=?').get(row.name).n,0);
});

test('Public Tennessee suggestions without a bar number wait for review and publish with a unique profile identity',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts');
 for(const [i,name] of ['Tennessee Example Attorney','Second Tennessee Attorney'].entries()){
  const draft={action:'submit',kind:'lawyer',practiceAreas:'Family law',state:'TN',barNumber:'',name,firmName:'Example Firm',city:'Chattanooga',officialSourceUrl:'https://example.test/member/'+i,submitterName:'Submitter',submitterEmail:'submitter@example.test'};
  const response=await api.POST(request(draft,''));assert.equal(response.status,200);const {id}=await response.json();assert.ok(id);
  assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorneys WHERE state=?').get('TN').n,i);
  const unverified=await api.POST(request({action:'review',id,decision:'approve',barStatus:'Member in Good Standing'},'admin','admin@example.test'));assert.equal(unverified.status,400);
  const approved=await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Member in Good Standing'},'admin','admin@example.test'));assert.equal(approved.status,200);
  const saved=x.sql.prepare('SELECT * FROM attorneys WHERE name=?').get(name);assert.match(saved.bar_number,/^TN:LV[0-9a-f]{32}$/);assert.equal(saved.license_number,null);
 }
 assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorneys WHERE state=?').get('TN').n,2);
 x.sql.close();
});

test('Public lawyer suggestions require an official member directory link with the requested error',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts');
 for(const state of ['TN','GA'])for(const officialSourceUrl of ['', '   ']){
  const response=await api.POST(request({action:'submit',kind:'lawyer',practiceAreas:'Family law',state,barNumber:'123456',name:'Example Attorney',city:state==='GA'?'Atlanta':'Chattanooga',officialSourceUrl,submitterName:'Submitter',submitterEmail:'submitter@example.test'},''));
  assert.equal(response.status,400);assert.equal((await response.json()).error,'Please add official member directory link.');
 }
 assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM directory_submissions').get().n,0);x.sql.close();
});


test('Submitted lawyer fields survive approval and existing published firm links recover without exposing private details',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts'),profiles=await x.load('app/api/profiles/route.ts'),publicData=await x.load('db/public-directory.ts'),search=await x.load('app/api/attorneys/route.ts');
 const draft={action:'submit',kind:'lawyer',practiceAreas:'Family law',state:'TN',name:'Caitlin Test Attorney',address:'123 Main Street',zip:'37902',admitDate:'2012-05-04',lawSchool:'Test Law School',county:'Knox',membershipStatus:'Member in Good Standing',phone:'865-555-0100',publicEmail:'attorney@testfirm.example',firmName:'Test Firm PLLC',firmWebsite:'https://testfirm.example/',city:'Knoxville',officialSourceUrl:'https://example.test/member/caitlin',website:'https://testfirm.example/attorneys/caitlin',linkedinUrl:'https://www.linkedin.com/in/caitlin-test/',firmLinkedInUrl:'https://www.linkedin.com/company/testfirm/',practiceAreas:'Family law, Business law',submitterName:'PRIVATE SUBMITTER',submitterEmail:'private@example.test',notes:'PRIVATE REVIEW NOTES'};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');const form=new FormData();form.set('data',JSON.stringify(draft));form.set('photo',new File([png],'photo.png',{type:'image/png'}));
 const submitted=await api.POST(new Request('https://lawvetter.test/api/directory-submissions',{method:'POST',headers:{Origin:'https://lawvetter.test'},body:form}));assert.equal(submitted.status,200);const {id}=await submitted.json();
 const links=await x.load('db/submitted-firm.ts');assert.equal((await links.submittedFirmSettings('testfirmpllc')).website,null);
 assert.equal((await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Member in Good Standing'},'admin','admin@example.test'))).status,200);
 const attorney=x.sql.prepare('SELECT * FROM attorneys WHERE name=?').get(draft.name),bar=attorney.bar_number;assert.equal(attorney.address,draft.address);assert.equal(attorney.zip,draft.zip);assert.equal(attorney.admit_date,draft.admitDate);assert.equal(attorney.law_school,draft.lawSchool);assert.equal(attorney.county,draft.county);assert.equal(attorney.status,draft.membershipStatus);assert.equal(attorney.phone,draft.phone);assert.equal(attorney.email,draft.publicEmail);assert.equal(attorney.company,draft.firmName);assert.equal(attorney.city,draft.city);assert.equal(attorney.state,draft.state);assert.equal(attorney.source_url,draft.officialSourceUrl);assert.equal(attorney.license_number,null);
 const profile=x.sql.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get(bar);assert.equal(profile.website,draft.website);assert.equal(profile.linkedin_url,draft.linkedinUrl);assert.equal(profile.practice_areas,draft.practiceAreas);assert.ok(profile.photo_key.startsWith('submissions/'));
 async function check(){const state=await publicData.publicProfileState(bar);assert.equal(state.firmWebsite,draft.firmWebsite);assert.equal(state.firmLinkedInUrl,draft.firmLinkedInUrl);assert.equal(state.profile.website,draft.website);const response=await profiles.POST(request({action:'view',bar},''));assert.equal(response.status,200);const viewed=await response.json();assert.equal(viewed.firmWebsite,draft.firmWebsite);assert.equal(viewed.firmLinkedInUrl,draft.firmLinkedInUrl);const firm=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=Test%20Firm%20PLLC'))).json();assert.equal(firm.firm.website,draft.firmWebsite);assert.equal(firm.firm.linkedinUrl,draft.firmLinkedInUrl);const publicText=JSON.stringify([state,viewed,firm]);assert.ok(!publicText.includes(draft.submitterEmail));assert.ok(!publicText.includes(draft.notes));}
 await check();x.sql.prepare('DELETE FROM firm_settings WHERE key=?').run('testfirmpllc');await check();
 x.sql.prepare('INSERT INTO firm_settings(key,website,updated_at) VALUES(?,?,?)').run('testfirmpllc','https://admin-updated.example/','now');assert.equal((await publicData.publicProfileState(bar)).firmWebsite,'https://admin-updated.example/');
});


test('Public lawyer intake requires catalog practice areas and validates optional public email',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts');
 const draft={action:'submit',kind:'lawyer',state:'TN',name:'Required Practice Attorney',city:'Knoxville',officialSourceUrl:'https://example.test/member/required',submitterName:'Submitter',submitterEmail:'submitter@example.test'};
 for(const practiceAreas of ['', ' , ; ', 'Invented Practice Category', 'Family Law, Invented Practice Category']){const response=await api.POST(request({...draft,practiceAreas},''));assert.equal(response.status,400);assert.match((await response.json()).error,/practice area/i);}
 for(const change of [{membershipStatus:'Inactive'},{admitDate:'2030-01-01'},{admitDate:'2020-02-31'}]){assert.equal((await api.POST(request({...draft,practiceAreas:'Family law',...change},''))).status,400);}
 const badEmail=await api.POST(request({...draft,practiceAreas:'Family law',publicEmail:'invalid'},''));assert.equal(badEmail.status,400);assert.match((await badEmail.json()).error,/email/i);assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM directory_submissions').get().n,0);
 const response=await api.POST(request({...draft,practiceAreas:'Aviation'},''));assert.equal(response.status,200);const {id}=await response.json();assert.equal((await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Member in Good Standing'},'admin','admin@example.test'))).status,200);const saved=x.sql.prepare('SELECT phone,email FROM attorneys WHERE name=?').get(draft.name);assert.equal(saved.phone,'');assert.equal(saved.email,'');
});

test('Homepage rotation retains 20 unique active profiles as weekly searches expire without inventing ranks',async()=>{
 for(const weeklyCount of [0,10,20,25]){
  const x=await runtime();
  for(let i=0;i<30;i++)x.seed(String(700000+i),'Attorney '+String(i).padStart(2,'0'));
  x.seed('inactive','Inactive Attorney','Example Legal LLC','Suspended');
  const add=x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)'),now=new Date().toISOString(),old=new Date(Date.now()-40*86400000).toISOString();
  for(let i=0;i<weeklyCount;i++)add.run('recent-'+i,String(700000+i),now);
  add.run('historic','700029',old);add.run('excluded','inactive',now);
  const charts=await x.load('app/api/attorneys/charts.ts'),data=await charts.discoveryData(x.db);
  assert.equal(data.popular.length,20);assert.equal(new Set(data.popular.map(a=>a.bar_number)).size,20);
  assert.equal(data.weekly.length,weeklyCount);
  assert.deepEqual(Array.from(data.popular.slice(0,data.weekly.length),a=>a.bar_number),Array.from(data.weekly.slice(0,20),a=>a.bar_number));
  assert.ok(data.popular.every(a=>a.status==='Active Member in Good Standing'&&!('searches' in a)));
  assert.ok(data.popular.slice(data.weekly.length).every(a=>a.rank===null));
  if(weeklyCount<20)assert.equal(data.popular[data.weekly.length].bar_number,'700029');
 }
 const x=await runtime();x.seed('one','Only Attorney');const charts=await x.load('app/api/attorneys/charts.ts');
 assert.equal((await charts.discoveryData(x.db)).popular.length,1);
});

test('Dashboard inquiry queue is private, prioritizes new requests, and inbox links locate older inquiries',async()=>{
 const x=await runtime(),insert=x.sql.prepare('INSERT INTO client_leads(id,name,email,city,practice,summary,contact_method,consent_version,status,created_at,updated_at,attorney_name,notification_payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(let i=0;i<30;i++){const id='inquiry-'+String(i).padStart(2,'0'),date=new Date(Date.UTC(2026,9,1+i)).toISOString();insert.run(id,'Client '+i,'client'+i+'@example.test','Tampa','family-law','PRIVATE MESSAGE','email','v1',i<2?'new':'contacted',date,date,'Attorney Example','PRIVATE PROVIDER PAYLOAD');}
 const overview=await x.load('app/api/admin/overview/route.ts');assert.equal((await overview.GET(new Request('https://lawvetter.test/api/admin/overview'))).status,401);
 const r=await overview.GET(new Request('https://lawvetter.test/api/admin/overview',{headers:{Cookie:adminTestCookie}})),d=await r.json();
 assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(d.totals.inquiries,2);assert.equal(d.inquiryQueue.length,6);assert.deepEqual(d.inquiryQueue.slice(0,2).map(i=>i.id),['inquiry-00','inquiry-01']);assert.equal(d.inquiryQueue[2].id,'inquiry-29');assert.ok(!JSON.stringify(d.inquiryQueue).includes('PRIVATE'));assert.ok(!JSON.stringify(d.inquiryQueue).includes('@'));
 const inbox=await x.load('app/api/leads/route.ts'),target=new Request('https://lawvetter.test/api/leads?id=inquiry-00',{headers:{Cookie:adminTestCookie}});const data=await(await inbox.GET(target)).json();assert.equal(data.page,2);assert.ok(data.leads.some(i=>i.id==='inquiry-00'));assert.equal((await inbox.GET(new Request(target.url))).status,403);
});


test('Administrator can manually re-add a deleted attorney while imports stay blocked and deletion history is retained',async()=>{
 const x=await runtime();x.seed('FL:912345','Deleted Florida Attorney');x.sql.prepare("UPDATE attorneys SET state='FL',license_number='912345' WHERE bar_number='FL:912345'").run();
 const api=await x.load('app/api/admin/records/route.ts');assert.equal((await api.DELETE(deletionRequest('attorneys','FL:912345'))).status,200);
 const payload={kind:'attorneys',record:{_new:1,state:'FL',barNumber:'912345',name:'Restored Florida Attorney',city:'Miami',status:'Member in Good Standing',bio:'New biography',company:'Example Legal LLC'}};
 const post=(p=payload,user='admin',email='admin@example.test')=>api.POST(request(p,user,email));
 assert.equal((await post(payload,'','')).status,401);
 const saver=await x.load('db/admin-records.ts');await assert.rejects(saver.saveAttorney(payload.record,'import',true,true),/deleted/);
 const result=await post();assert.equal(result.status,200,JSON.stringify(await result.clone().json()));assert.equal((await result.json()).id,'FL:912345');
 assert.equal(x.sql.prepare("SELECT name FROM attorneys WHERE bar_number='FL:912345'").get().name,payload.record.name);
 assert.equal(x.sql.prepare("SELECT bio FROM attorney_profiles WHERE bar_number='FL:912345'").get().bio,'New biography');
 assert.equal(x.sql.prepare("SELECT count(*) n FROM admin_audit WHERE action='attorney-delete' AND record_id='FL:912345'").get().n,1);
 assert.equal(x.sql.prepare("SELECT actor FROM admin_audit WHERE action='attorney-restore' AND record_id='FL:912345'").get().actor,'admin@example.test');
 assert.equal((await post()).status,409);
 assert.equal((await post({...payload,record:{...payload.record,_new:0,_id:'FL:912345',name:'Edited after restore'}})).status,200);
 await assert.rejects(saver.saveAttorney(payload.record,'import',true,true),/deleted/);
 assert.equal((await api.DELETE(deletionRequest('attorneys','FL:912345'))).status,200);
 assert.equal(x.sql.prepare("SELECT count(*) n FROM attorneys WHERE bar_number='FL:912345'").get().n,0);
 x.sql.exec("CREATE TRIGGER fail_restore BEFORE INSERT ON attorneys BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
 assert.equal((await post()).status,400);assert.equal(x.sql.prepare("SELECT count(*) n FROM admin_audit WHERE action='attorney-restore'").get().n,1);
});


test('Admin records expose the current public profile URL after an attorney is deleted and re-added',async()=>{
 const x=await runtime();x.seed('FL:259454','Regina Zelonker');x.sql.prepare("UPDATE attorneys SET state='FL',license_number='259454' WHERE bar_number='FL:259454'").run();
 const api=await x.load('app/api/admin/records/route.ts'),listing=()=>api.GET(new Request('https://lawvetter.test/api/admin/records?kind=attorneys&q=Regina',{headers:{Cookie:adminTestCookie}}));
 const before=await(await listing()).json();assert.ok(before.records[0].public_id);const oldId=before.records[0].public_id;
 assert.equal((await api.DELETE(deletionRequest('attorneys','FL:259454'))).status,200);
 assert.equal((await api.POST(request({kind:'attorneys',record:{_new:1,name:'Regina Zelonker',state:'FL',barNumber:'259454',city:'Miami',status:'Member in Good Standing'}},'admin','admin@example.test'))).status,200);
 const after=await(await listing()).json(),row=after.records[0];assert.ok(row.public_id);assert.notEqual(row.public_id,oldId);
 const links=await x.load('app/admin/records/profile-link.ts'),seo=await x.load('app/seo.ts');assert.equal(links.adminAttorneyPath(row),seo.attorneyPath(row));assert.ok(!links.adminAttorneyPath(row).includes(oldId));
 assert.equal(links.adminAttorneyPath({_id:row.bar_number,_publicId:row.public_id,name:row.name}),seo.attorneyPath(row));
 assert.match(links.adminAttorneyPath({bar_number:'FL:259454',name:'Regina Zelonker'}),/source=admin/);
});


test('an approved attorney owner cannot claim another attorney profile',async()=>{const x=await runtime();x.seed('100001','Owned Attorney');x.seed('100002','Other Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run('100001','attorney-a','approved','now');const profiles=await x.load('app/api/profiles/route.ts');
 const state=await(await profiles.POST(request({action:'view',bar:'100002'}))).json();assert.equal(state.canClaim,false);
 const response=await profiles.POST(request({action:'claim',bar:'100002',fullName:'Other Attorney',verification:'The authority details would otherwise be valid.',attestation:true}));assert.equal(response.status,409);assert.equal(x.sql.prepare('SELECT COUNT(*) n FROM profile_claims').get().n,0);
 const unowned=await(await profiles.POST(request({action:'view',bar:'100002'},'attorney-b','b@example.test'))).json();assert.equal(unowned.canClaim,true);
});

function internalBar(x,ref){assert.match(ref,/^LV[0-9a-f]{32}$/);const row=x.sql.prepare('SELECT bar_number FROM attorneys WHERE public_id=?').get(ref.slice(2));assert.ok(row);return row.bar_number;}

test('Language selections persist through admin edits and owner saves, enforce ownership and clear without defaults',async()=>{
 const x=await runtime();x.seed('100001','Language Attorney');x.seed('100002','Empty Attorney');
 const {normalizeLanguages}=await x.load('app/languages.ts');assert.equal(normalizeLanguages('spanish, English, spanish'),'Spanish, English');
 const records=await x.load('db/admin-records.ts');
 const input={recordId:'100001',barNumber:'100001',name:'Language Attorney',city:'Atlanta',state:'GA',status:'Member in Good Standing',languages:'spanish, English, spanish'};
 await records.saveAttorney(records.validateAttorney(input),'admin');
 assert.equal(x.sql.prepare('SELECT languages FROM attorney_profiles WHERE bar_number=?').get('100001').languages,'Spanish, English');
 x.sql.prepare("UPDATE attorney_profiles SET owner_id='attorney-a',claimed_at='approved' WHERE bar_number='100001'").run();
 const api=await x.load('app/api/profiles/route.ts'),payload={action:'save',bar:'100001',headline:'',bio:'',practiceAreas:'',website:''};
 assert.equal((await api.POST(request({...payload,languages:'French'},'other-owner','other@example.test'))).status,403);
 assert.equal(x.sql.prepare('SELECT languages FROM attorney_profiles WHERE bar_number=?').get('100001').languages,'Spanish, English');
 assert.equal((await api.POST(request({...payload,languages:'Spansih'}))).status,400);
 assert.equal((await api.POST(request(payload))).status,200);assert.equal(x.sql.prepare('SELECT languages FROM attorney_profiles WHERE bar_number=?').get('100001').languages,'Spanish, English');
 const view=await(await api.POST(request({action:'view',bar:'100001'},''))).json();assert.equal(view.profile.languages,'Spanish, English');
 const publicProfile=await x.load('db/public-directory.ts');assert.equal((await publicProfile.publicProfileState('100001')).profile.languages,'Spanish, English');
 assert.equal((await api.POST(request({...payload,languages:''}))).status,200);assert.equal(x.sql.prepare('SELECT languages FROM attorney_profiles WHERE bar_number=?').get('100001').languages,'');
 await records.saveAttorney(records.validateAttorney({...input,recordId:'100002',barNumber:'100002',name:'Empty Attorney',languages:undefined}),'admin');
 assert.equal(x.sql.prepare('SELECT languages FROM attorney_profiles WHERE bar_number=?').get('100002')?.languages??'','');
});
test('Languages survive public attorney submission and approval without affecting unselected profiles',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts');
 const draft={action:'submit',kind:'lawyer',practiceAreas:'Family law',state:'GA',barNumber:'300001',name:'Language Submission',firmName:'Language Firm',city:'Atlanta',officialSourceUrl:'https://example.test/official',submitterName:'Submitter',submitterEmail:'submitter@example.test',languages:'spanish, french'};
 const invalid=await api.POST(request({...draft,languages:'Not a language'},''));assert.equal(invalid.status,400);
 const response=await api.POST(request(draft,'')),created=await response.json();assert.equal(response.status,200,JSON.stringify(created));
 const details=await x.load('db/directory-details.ts');assert.equal(details.directoryDetails(x.sql.prepare('SELECT notes FROM directory_submissions WHERE id=?').get(created.id).notes).languages,'Spanish, French');
 const approved=await api.POST(request({action:'review',id:created.id,decision:'approve',officiallyVerified:true,barStatus:'Member in Good Standing'},'admin','admin@example.test'));assert.equal(approved.status,200,await approved.text());
 assert.equal(x.sql.prepare('SELECT languages FROM attorney_profiles WHERE bar_number=?').get('300001').languages,'Spanish, French');
});
test('Firm roster exposes only each attorney’s saved languages and reflects removal without defaults',async()=>{
 const x=await runtime();x.seed('100001','Bilingual Lawyer');x.seed('100002','Unspecified Lawyer');x.seed('100003','Other Firm Lawyer','Other Firm');
 x.sql.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,languages,claimed_at,updated_at) VALUES('100001','','English, Spanish','','now'),('100003','','French','','now')").run();
 const api=await x.load('app/api/attorneys/route.ts');
 const read=async()=>{const response=await api.POST(request({firm:'Example Legal LLC'}));assert.equal(response.status,200);return (await response.json()).attorneys;};
 let rows=await read();assert.equal(rows.length,2);assert.equal(rows.find(row=>row.name==='Bilingual Lawyer').languages,'English, Spanish');assert.equal(rows.find(row=>row.name==='Unspecified Lawyer').languages,null);assert.ok(rows.every(row=>row.languages!=='French'));
 x.sql.prepare("UPDATE attorney_profiles SET languages='' WHERE bar_number='100001'").run();rows=await read();assert.equal(rows.find(row=>row.name==='Bilingual Lawyer').languages,'');
});
