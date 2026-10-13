import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as nodeCrypto from 'node:crypto';
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
 const api=await x.load('app/api/directory-submissions/route.ts');const draft={action:'submit',kind:'lawyer',state:'GA',barNumber:'600150',name:'New Georgia Attorney',firmName:'Georgia Firm',city:'Atlanta',officialSourceUrl:'https://example.test/official',submitterName:'Submitter',submitterEmail:'submitter@example.test'};
 const {id}=await(await api.POST(request(draft,''))).json();assert.equal((await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 assert.equal(x.sql.prepare('SELECT state FROM attorneys WHERE bar_number=?').get('GA:600150').state,'GA');assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('600150').name,'Legacy Florida Attorney');
 x.env.ATTORNEY_IMPORT_KEY='test-key';const importer=await x.load('app/api/admin/import/route.ts');const row={barNumber:'600150',id:'AB123',name:'Updated Georgia Attorney',company:'Georgia Firm',city:'Atlanta',state:'GA',county:'Fulton',status:'Active Member in Good Standing',admitDate:'2020-01-01',lawSchool:'Example Law School',address:'',zip:'',phone:'',email:'',sourceUrl:'https://www.gabar.org/member-directory/?id=AB123',importedAt:'2026-10-12'};
 const imported=await importer.POST(new Request('https://lawvetter.test/api/admin/import',{method:'POST',headers:{Authorization:'Bearer test-key','Content-Type':'application/json'},body:JSON.stringify([row])}));assert.equal(imported.status,200);assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('600150').name,'Legacy Florida Attorney');assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('GA:600150').name,row.name);
 assert.throws(()=>x.sql.prepare('INSERT INTO attorneys(bar_number,license_number,source_id,name,state,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run('FL:600150','600150','another','Duplicate','FL','Active Member in Good Standing','https://example.test','2026-10-12'));
});
test('City suggestions narrow by state and prefix, while accepting cities beyond the suggestions',async()=>{
 const x=await runtime();x.seed('100001','Georgia Attorney');x.seed('100002','Florida Attorney');x.sql.prepare("UPDATE attorneys SET state='FL',city='Tampa Bay' WHERE bar_number='100002'").run();
 const api=await x.load('app/api/cities/route.ts');const fl=await(await api.GET(new Request('https://lawvetter.test/api/cities?state=FL&q=Tam'))).json();assert.ok(fl.cities.includes('Tampa'));assert.ok(fl.cities.includes('Tampa Bay'));assert.ok(!fl.cities.includes('Atlanta'));
 const ga=await(await api.GET(new Request('https://lawvetter.test/api/cities?state=GA&q=Atl'))).json();assert.deepEqual(ga.cities,['Atlanta']);
});
test('Combined public attorney, firm and photo submissions stay private until approval and join one firm group',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts'),search=await x.load('app/api/attorneys/route.ts'),photos=await x.load('app/api/profile-photo/route.ts');
 const draft={action:'submit',kind:'lawyer',state:'FL',barNumber:'900001',name:'New Florida Attorney',firmName:'New Firm, P.A.',firmWebsite:'https://new-firm.example.test/',city:'Tampa',officialSourceUrl:'https://example.test/record',submitterName:'Submitter',submitterEmail:'submitter@example.test',photoConsent:true};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg==','base64');
 const multipart=(data,file)=>{const form=new FormData();form.set('data',JSON.stringify(data));form.set('photo',new File([file],'portrait.png',{type:'image/png'}));return new Request('https://lawvetter.test/api/directory-submissions',{method:'POST',headers:{Origin:'https://lawvetter.test'},body:form});};
 assert.equal((await api.POST(multipart(draft,Buffer.from('not an image')))).status,400);assert.equal(x.sql.prepare('SELECT count(*) n FROM directory_submissions').get().n,0);
 const submitted=await api.POST(multipart(draft,png));assert.equal(submitted.status,200);const {id}=await submitted.json();assert.equal(x.files.size,1);assert.equal((await photos.GET(new Request('https://lawvetter.test/api/profile-photo?submission='+id))).status,404);
 assert.equal((await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Firm%20PA'))).status,404);
 assert.equal((await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 const firm=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Firm%20PA'))).json();assert.equal(firm.firm.total,1);assert.equal(firm.firm.website,draft.firmWebsite);assert.equal(firm.attorneys[0].bar_number,'FL:900001');
 assert.equal((await photos.GET(new Request('https://lawvetter.test/api/profile-photo?bar=FL:900001'))).status,200);
 const second=await(await api.POST(request({...draft,barNumber:'900002',name:'Second Florida Attorney',firmName:'New Firm PA',firmWebsite:'',photoConsent:false},''))).json();assert.ok(second.id);assert.equal((await api.POST(request({action:'review',id:second.id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 const grouped=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?firm=New%20Firm%20PA'))).json();assert.equal(grouped.firm.total,2);assert.equal(grouped.firm.website,draft.firmWebsite);assert.ok(grouped.attorneys.every(a=>a.company==='New Firm, P.A.'));
});
test('Georgia and Florida licenses with the same number publish separately without moving existing profile ownership',async()=>{
 const x=await runtime();x.seed('500150','Existing Georgia Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES(?,?,?,?,?)').run('500150','original-owner','2026-10-01','2026-10-01','Preserved biography');
 const api=await x.load('app/api/directory-submissions/route.ts'),search=await x.load('app/api/attorneys/route.ts'),profiles=await x.load('app/api/profiles/route.ts'),reviews=await x.load('app/api/client-reviews/route.ts');
 const draft={action:'submit',kind:'lawyer',state:'FL',barNumber:'500150',name:'Florida Attorney',firmName:'Florida Firm',city:'Tampa',officialSourceUrl:'https://example.test/official',submitterName:'Submitter',submitterEmail:'submitter@example.test'};
 const {id}=await(await api.POST(request(draft,''))).json();assert.ok(id);const approve=await api.POST(request({action:'review',id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'));assert.equal(approve.status,200);
 const ga=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('500150'),fl=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('FL:500150');assert.equal(ga.name,'Existing Georgia Attorney');assert.equal(ga.state,'GA');assert.equal(fl.state,'FL');assert.equal(fl.license_number,'500150');
 assert.equal(x.sql.prepare('SELECT bio FROM attorney_profiles WHERE bar_number=?').get('500150').bio,'Preserved biography');assert.equal(x.sql.prepare('SELECT owner_id FROM attorney_profiles WHERE bar_number=?').get('500150').owner_id,'original-owner');
 const matches=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?q=500150'))).json();assert.equal(matches.total,2);const qualified=await(await search.GET(new Request('https://lawvetter.test/api/attorneys?q=FL%3A500150'))).json();assert.equal(qualified.total,1);assert.equal(qualified.attorneys[0].name,'Florida Attorney');
 assert.equal((await reviews.GET(new Request('https://lawvetter.test/api/client-reviews?bar=FL:500150'))).status,200);
 assert.equal((await profiles.POST(request({action:'claim',bar:'FL:500150',fullName:'Florida Attorney',verification:'Official firm profile and independent identification.',attestation:true},'fl-owner','fl-owner@example.test'))).status,200);
 assert.throws(()=>x.sql.prepare('INSERT INTO attorneys(bar_number,license_number,source_id,name,state,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run('another-id','500150','another','Duplicate','FL','Active Member in Good Standing','https://example.test','2026-10-12'));
});
function database(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));const db={prepare(text){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){const x=sql.prepare(text).run(...args);return {meta:{changes:Number(x.changes)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {sql,db};}
async function runtime(options={}){const {sql,db}=database(),files=new Map();const env={DB:db,CLAIM_ADMIN_EMAIL:'admin@example.test',PROFILE_PHOTOS:{async put(key,buffer,metadata){files.set(key,{body:buffer,...metadata});},async get(key){return files.get(key)},async delete(key){files.delete(key)}}};const context=vm.createContext({console,Request,Response,URL,File,FormData,Uint8Array,Buffer,Date,Intl,crypto:webcrypto,AbortSignal,fetch:options.fetch});const cache=new Map();async function module(file){if(cache.has(file))return cache.get(file);if(file==='node:crypto'){const m=new vm.SyntheticModule(Object.keys(nodeCrypto),function(){for(const [k,v] of Object.entries(nodeCrypto))this.setExport(k,v)},{context});cache.set(file,m);await m.link(()=>{});return m;}if(file==='cloudflare:workers'){const m=new vm.SyntheticModule(['env'],function(){this.setExport('env',env)},{context});cache.set(file,m);await m.link(()=>{});return m;}const text=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const m=new vm.SourceTextModule(text,{context,identifier:file});cache.set(file,m);await m.link(async(spec,parent)=>module((spec==='cloudflare:workers'||spec==='node:crypto')?spec:path.resolve(path.dirname(parent.identifier),spec)+'.ts'));return m;}async function load(file){const m=await module(path.join(root,file));await m.evaluate();return m.namespace;}function seed(bar,name,company='Example Legal LLC',status='Active Member in Good Standing'){sql.prepare('INSERT INTO attorneys(bar_number,source_id,name,company,city,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run(bar,bar,name,company,'Atlanta',status,'https://example.test/record','2026-10-08T00:00:00Z');}return {sql,db,load,seed,files,env};}
function request(data,user='attorney-a',email='a@example.test'){const headers={'Content-Type':'application/json',Origin:'https://lawvetter.test'};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=email;}return new Request('https://lawvetter.test/api/profiles',{method:'POST',headers,body:JSON.stringify(data)});}
test('Directory initials find full middle names without breaking word boundaries or practice filters',async()=>{
 const x=await runtime();x.seed('004170','Randall Mark Kessler','Kessler & Solomiany LLC');x.seed('100001','Randall Michael Other');x.seed('100002','United Smith');
 const api=await x.load('app/api/attorneys/route.ts');
 for(const q of ['Randall M. Kessler','Randall Kessler','Randy Kessler','R. M. Kessler','004170']){
  const r=await(await api.POST(request({q,statusGroup:'active'}))).json();assert.equal(r.total,1,q);assert.equal(r.attorneys[0].bar_number,'004170',q);
 }
 assert.equal((await(await api.POST(request({q:'Ted'}))).json()).total,0);
 const family=await(await api.POST(request({q:'Randall M. Kessler',practice:'family-law',statusGroup:'active'}))).json();assert.equal(family.attorneys[0].bar_number,'004170');
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
 assert.equal((await profiles.POST(request({action:'review',id,decision:'approve',verified:true},'site-owner','admin@example.test'))).status,200);
 state=await (await profiles.POST(request({action:'view',bar:'100001'}))).json();assert.ok(state.profile);assert.equal(state.isOwner,true);
 const edit={action:'save',bar:'100001',headline:'Fictional headline',bio:'Saved bio',practiceAreas:'Mediation',website:'https://example.test'};
 assert.equal((await profiles.POST(request(edit,'attorney-b','b@example.test'))).status,403);assert.equal((await profiles.POST(request(edit))).status,200);
 assert.equal((await (await profiles.POST(request({action:'view',bar:'100001'}))).json()).profile.bio,'Saved bio');
 assert.equal((await profiles.POST(request({...edit,website:'javascript:alert(1)'}))).status,400);
 const shortlist=await x.load('app/api/shortlist/route.ts'),auth=await x.load('app/api/client-auth/route.ts');
 // Platform sign-in does not establish a LawVetter client session.
 assert.equal((await shortlist.POST(request({action:'list'}))).status,401);
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
 const active=await(await api.POST(request({q:'Fictional',statusGroup:'active'}))).json();const inactive=await(await api.POST(request({q:'Fictional',statusGroup:'not-active'}))).json();assert.equal(active.total,2);assert.equal(inactive.total,1);assert.equal(inactive.attorneys[0].bar_number,'100003');
});
test('Practice browsing combines sourced classifications and exact owner-provided areas without inventing coverage',async()=>{const x=await runtime();x.seed('231458','Source Classified Attorney');x.seed('100001','Owner Classified Attorney');x.seed('100002','Unrelated Attorney');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,claimed_at,updated_at) VALUES(?,?,?,?,?)').run('100001','owner','Family law, Employment law','2026-10-08','2026-10-08');x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,practice_areas,claimed_at,updated_at) VALUES(?,?,?,?,?)').run('100002','other','Non-family law related consulting','2026-10-08','2026-10-08');const api=await x.load('app/api/attorneys/route.ts');const results=await(await api.POST(request({practice:'family-law',statusGroup:'active'}))).json();assert.equal(results.total,2);assert.deepEqual(results.attorneys.map(a=>a.bar_number).sort(),['100001','231458']);assert.equal((await api.POST(request({practice:'made-up'}))).status,400);const narrowed=await(await api.POST(request({practice:'family-law',q:'Owner'}))).json();assert.equal(narrowed.total,1);assert.equal(narrowed.attorneys[0].bar_number,'100001');});
test('Client requests persist once, require consent, and remain owner-only',async()=>{const x=await runtime(),api=await x.load('app/api/leads/route.ts');const data={id:'12345678-1234-4123-8123-123456789012',name:'Test Client',email:'client@example.test',phone:'',city:'Atlanta, GA',practice:'family-law',summary:'I need help with a family law matter.',contactMethod:'email',consent:true};assert.equal((await api.POST(request({...data,consent:false},''))).status,400);assert.equal((await api.POST(request(data,''))).status,201);assert.equal((await api.POST(request(data,''))).status,200);assert.equal(x.sql.prepare('SELECT count(*) AS n FROM client_leads').get().n,1);assert.equal((await api.GET(request({},''))).status,403);assert.equal((await api.GET(request({},'other','other@example.test'))).status,403);const result=await(await api.GET(request({},'admin','admin@example.test'))).json();assert.equal(result.leads[0].email,data.email);assert.equal((await api.POST(request({action:'status',id:data.id,status:'contacted'},'other'))).status,403);assert.equal((await api.POST(request({action:'status',id:data.id,status:'contacted'},'admin','admin@example.test'))).status,200);assert.equal(x.sql.prepare('SELECT status FROM client_leads').get().status,'contacted');const cross=new Request('https://lawvetter.test/api/leads',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal((await api.POST(cross)).status,403);});
test('Expanded practice results paginate all matched records without a bind-per-attorney limit',async()=>{const x=await runtime(),{practiceSources,practiceAreas}=await x.load('app/practice-areas.ts');for(const bar of Object.keys(practiceSources))x.seed(bar,'Attorney '+bar);const api=await x.load('app/api/attorneys/route.ts');for(const area of practiceAreas){const expected=Object.entries(practiceSources).filter(([,s])=>s.areas.includes(area.id)).map(([bar])=>bar).sort();const found=[];for(let page=1;page<=Math.ceil(expected.length/25);page++){const result=await(await api.POST(request({practice:area.id,statusGroup:'active',page}))).json();assert.equal(result.total,expected.length);found.push(...result.attorneys.map(a=>a.bar_number));}assert.deepEqual(found.sort(),expected);}assert.ok(Object.values(practiceSources).filter(s=>s.areas.includes('family-law')).length>25);});
test('Exact search totals stay out of visitor data and owner analytics reject other users',async()=>{const x=await runtime();x.seed('100001','Test Attorney');x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('event','100001',new Date().toISOString());const charts=await x.load('app/api/attorneys/charts.ts');const visible=await charts.discoveryData(x.db);assert.equal(visible.weekly.length,1);assert.equal('searches' in visible.weekly[0],false);const api=await x.load('app/api/admin/searches/route.ts');assert.equal((await api.GET(request({},'other','other@example.test'))).status,403);const owner=await(await api.GET(request({},'admin','admin@example.test'))).json();assert.equal(owner.weekly[0].searches,1);});
test('Firm roster sorts by current monthly search rank before name',async()=>{const x=await runtime();x.seed('100001','Aaron First');x.seed('100002','Zoe Popular');const now=new Date().toISOString();x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('one','100002',now);const api=await x.load('app/api/attorneys/route.ts');const results=await(await api.POST(request({firm:'Example Legal LLC'}))).json();assert.deepEqual(results.attorneys.map(a=>a.bar_number),['100002','100001']);assert.equal('searches' in results.attorneys[0],false);});
test('Attorney analytics require sign-in and approved ownership, and never expose another profile',async()=>{const x=await runtime();x.seed('100001','Attorney One');x.seed('100002','Attorney Two');for(const [bar,owner] of [['100001','one'],['100002','two']])x.sql.prepare('INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) VALUES(?,?,?,?)').run(bar,owner,'2026-10-08','2026-10-08');const api=await x.load('app/api/account/analytics/route.ts');assert.equal((await api.GET(request({},''))).status,401);assert.equal((await api.GET(request({},'unapproved'))).status,403);const result=await(await api.GET(request({},'one'))).json();assert.equal(result.profiles.length,1);assert.equal(result.profiles[0].bar_number,'100001');});

test('Client passwords, persistent sessions, ownership, review approval and logout',async()=>{
 const x=await runtime();x.seed('100001','Fictional Attorney');
 const auth=await x.load('app/api/client-auth/route.ts'),reviews=await x.load('app/api/client-reviews/route.ts');
 const password='fictional test password only';
 const account={action:'register',firstName:'Test',lastName:'Client',email:'test@example.test',password,consent:true};
 const req=(data,cookie='',user='',email='')=>new Request('https://lawvetter.test/api/client-auth',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json',Cookie:cookie,'oai-authenticated-user-id':user,'oai-authenticated-user-email':email},body:JSON.stringify(data)});
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
 let publicData=await publicReviews();assert.equal(publicData.reviews[0].author,'Anonymous verified client');assert.equal(publicData.reviews[0].anonymous,1);for(const key of ['rating_use_again','rating_cared_for','rating_rights','rating_outcome'])assert.equal(publicData.reviews[0][key],review[key]);for(const secret of [account.email,'PRIVATE-CASE-42','identity_evidence',user])assert.ok(!JSON.stringify(publicData).includes(secret));
 assert.equal((await reviews.POST(req({...review,mode:'named'},session))).status,200);assert.equal((await publicReviews()).reviews[0].author,'Anonymous verified client');await approveReview();assert.equal((await publicReviews()).reviews[0].author,'Test Client');
 const b=await auth.POST(req({...account,email:'second@example.test',firstName:'Second',password:'123456789'}));assert.equal(b.status,201);const bCookie=cookie(b);
 assert.equal((await reviews.POST(req(review,bCookie))).status,403);assert.equal((await(await reviews.POST(req({action:'account'},bCookie))).json()).requests.length,0);
 const own=await(await reviews.POST(req({action:'account'},session))).json();assert.equal(own.requests[0].id,id);assert.equal(own.requests[0].rating_cared_for,4);assert.ok(!JSON.stringify(own).includes('identity_evidence'));
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
 const req=(data,cookie='',user='',email='')=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test','Content-Type':'application/json',Cookie:cookie,'oai-authenticated-user-id':user,'oai-authenticated-user-email':email},body:JSON.stringify(data)});
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
 const req=(body,cookie='',owner=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(owner?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
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
 const account=await api.POST(req({action:'account'},cookie)).then(r=>r.json());assert.equal(account.requests[0].status,'approved');assert.equal(account.requests[0].state,'GA');assert.equal(account.requests[0].document_date,'2026-09-17');assert.equal(account.requests[0].bar_number,'100001');
 const before=calls.length;assert.equal((await api.POST(req({action:'retry-email',id},'',true))).status,200);assert.equal(calls.length,before);
 const publicData=await api.GET(new Request('https://lawvetter.test/api/client-reviews?bar=100001')).then(r=>r.json());assert.ok(!JSON.stringify(publicData).includes('CORRECTED-CASE'));
});

test('Pending case details can be completed without duplicate requests, and the latest failed update alert is retried',async()=>{
 const calls=[];let rejectSend=false;const x=await runtime({fetch:async(url,init)=>{calls.push({url,init});return rejectSend?Response.json({error:'unavailable'},{status:503}):Response.json({id:'update-provider-'+calls.length});}});x.seed('100001','Update Attorney');
 x.env.RESEND_API_KEY='fictional-key';x.env.APPROVAL_EMAIL_FROM='LawVetter <no-reply@lawvetter.com>';
 const auth=await x.load('app/api/client-auth/route.ts'),api=await x.load('app/api/client-reviews/route.ts');
 const req=(body,cookie='',owner=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(owner?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
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
 const req=(body,cookie='',admin=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(admin?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
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
 const req=(body,cookie='',owner=false)=>new Request('https://lawvetter.test/api/client-reviews',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie,...(owner?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'}:{})},body:JSON.stringify(body)});
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
 assert.equal((await api.POST(req(edit,cookie))).status,200);assert.equal(calls.at(-1).to[0],'admin@example.test');assert.equal((await api.POST(req({...edit,body:'Another unapproved edit'},cookie))).status,409);let page=await publicPage();assert.equal(page.reviews[0].body,'Great lawyer.');assert.equal(page.reviews[0].author,'Anonymous verified client');assert.equal(page.reviews[0].rating_outcome,2);
 revision=x.sql.prepare('SELECT review_revision FROM client_verifications').get().review_revision;
 assert.equal((await api.POST(req({action:'review-decide',id,revision,decision:'reject',note:'Please revise the submitted text.'},'',true))).status,200);assert.equal((await publicPage()).reviews[0].body,'Great lawyer.');
 assert.equal((await api.POST(req(edit,cookie))).status,200);revision=x.sql.prepare('SELECT review_revision FROM client_verifications').get().review_revision;
 assert.equal((await api.POST(req({action:'review-decide',id,revision,decision:'approve'},'',true))).status,200);page=await publicPage();assert.equal(page.reviews[0].body,edit.body);assert.equal(page.reviews[0].author,'Review Client');assert.equal(page.reviews[0].rating_outcome,1);
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
 const claimId=x.sql.prepare('SELECT id FROM profile_claims WHERE bar_number=?').get('100001').id;
 assert.equal((await profiles.POST(request({action:'review',id:claimId,decision:'approve',verified:true},'admin','admin@example.test'))).status,200);
 const save={action:'save',authentication:'password',bar:'100001',headline:'My headline',bio:'My biography',practiceAreas:'Family law',website:'https://example.test/'};
 assert.equal((await profiles.POST(client(save))).status,200);assert.equal((await profiles.POST(client(save,''))).status,401);
 const draft={action:'submit',attorneyProfile:true,kind:'lawyer',state:'GA',barNumber:'100002',name:'New Attorney',submitterName:'New Attorney',submitterEmail:'spoof@example.test',officialSourceUrl:'https://example.test/official',firmName:'New Law LLC',city:'Atlanta',headline:'New headline',bio:'New biography',practiceAreas:'Family law',phone:'555-0100',publicEmail:'contact@example.test',notes:'Verify my firm biography and account email.',attestation:true};
 assert.equal((await directory.POST(request(draft,''))).status,401);
 assert.equal((await directory.POST(client({...draft,barNumber:'100001'}))).status,409);
 const submitted=await directory.POST(client(draft));assert.equal(submitted.status,200);const {id}=await submitted.json();assert.equal(x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('100002'),undefined);
 const record=x.sql.prepare('SELECT * FROM directory_submissions WHERE id=?').get(id);assert.equal(record.submitter_email,'new-attorney@example.test');
 const imageBytes=new Uint8Array(32);imageBytes.set([137,80,78,71,13,10,26,10]);const form=new FormData();form.set('submission',id);form.set('photo',new File([imageBytes],'photo.png',{type:'image/png'}));
 const upload=new Request('https://lawvetter.test/api/profile-photo',{method:'POST',headers:{Origin:'https://lawvetter.test',Cookie:cookie},body:form});assert.equal((await photos.POST(upload)).status,200);
 const photoURL='https://lawvetter.test/api/profile-photo?submission='+id;assert.equal((await photos.GET(new Request(photoURL))).status,404);assert.equal((await photos.GET(new Request(photoURL,{headers:{Cookie:cookie}}))).status,200);
 const review={action:'review',id,decision:'approve',officiallyVerified:true,identityVerified:true,barStatus:'Active Member in Good Standing'};
 assert.equal((await directory.POST(client(review))).status,403);assert.equal((await directory.POST(request({...review,identityVerified:false},'admin','admin@example.test'))).status,400);
 assert.equal((await directory.POST(request(review,'admin','admin@example.test'))).status,200);
 const approved=x.sql.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get('100002');assert.equal(approved.headline,'New headline');assert.ok(approved.photo_key.startsWith('submissions/'));assert.equal(x.sql.prepare('SELECT status FROM directory_submissions WHERE id=?').get(id).status,'published');
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
 const draft={action:'submit',kind:'lawyer',name:'Suggested Attorney',state:'GA',barNumber:'100005',city:'Atlanta',firmName:'Suggested Law LLC',firmWebsite:'https://suggested-law.example/',website:'https://suggested-law.example/attorney',officialSourceUrl:'https://example.test/licensing',submitterName:'Test Submitter',submitterEmail:'submitter@example.test',notes:'Check the official record.'};
 const saved=await(await api.POST(request(draft,''))).json();assert.equal(saved.notificationEmailStatus,'pending');const record=x.sql.prepare('SELECT * FROM directory_submissions WHERE id=?').get(saved.id);assert.equal(details.directoryDetails(record.notes).firmWebsite,draft.firmWebsite);assert.equal(calls[0].url,'https://api.resend.com/emails');const payload=JSON.parse(calls[0].init.body);assert.equal(payload.to[0],'admin@example.test');assert.equal(payload.from,'LawVetter <no-reply@lawvetter.com>');assert.ok(payload.text.includes('Suggested Attorney'));assert.ok(payload.text.includes(draft.firmWebsite));assert.ok(payload.text.includes('/admin/directory-submissions#submission-'));
 accept=true;const retry=await(await api.POST(request({action:'retry-notifications'},''))).json();assert.equal(retry.accepted,1);assert.equal(calls[1].init.headers['Idempotency-Key'],calls[0].init.headers['Idempotency-Key']);assert.equal(calls[1].init.body,calls[0].init.body);await api.POST(request({action:'retry-notifications'},''));assert.equal(calls.length,2);
 assert.equal((await api.POST(request({action:'review',id:saved.id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);const directory=await x.load('app/api/attorneys/route.ts');const firm=await(await directory.POST(request({firm:'Suggested Law LLC'}))).json();assert.equal(firm.firm.website,draft.firmWebsite);
});

test('Configured directory CAPTCHA rejects missing, expired, reused, and wrong-host tokens; submission rate limits and spam traps remain enforced',async()=>{
 const used=new Set();const x=await runtime({fetch:async(url,init)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');const d=JSON.parse(init.body);assert.equal(d.secret,'private-captcha-secret');if(d.response==='expired'||used.has(d.response))return Response.json({success:false});used.add(d.response);return Response.json({success:true,hostname:d.response==='wrong-host'?'wrong.test':'lawvetter.test',action:'directory_submission'});}});x.env.TURNSTILE_SITE_KEY='public-site-key';x.env.TURNSTILE_SECRET_KEY='private-captcha-secret';const api=await x.load('app/api/directory-submissions/route.ts');const config=await(await api.GET()).json();assert.equal(config.siteKey,'public-site-key');assert.equal(JSON.stringify(config).includes('private-captcha-secret'),false);
 const draft={action:'submit',kind:'lawyer',name:'Captcha Attorney',state:'GA',barNumber:'100010',officialSourceUrl:'https://example.test/licensing',submitterName:'Test Submitter',submitterEmail:'captcha@example.test'};
 for(const captchaToken of [undefined,'expired','wrong-host'])assert.equal((await api.POST(request({...draft,captchaToken},''))).status,400);
 assert.equal((await api.POST(request({...draft,captchaToken:'valid-token'},''))).status,200);
 assert.equal((await api.POST(request({...draft,name:'Another Attorney',barNumber:'100011',captchaToken:'valid-token'},''))).status,400);
 assert.equal(x.sql.prepare('SELECT count(*) AS total FROM directory_submissions').get().total,1);
 assert.equal((await api.POST(request({...draft,captchaToken:'new-token',companyWebsite:'bot value'},''))).status,400);
 for(let i=0;i<5;i++)await api.POST(request({...draft,captchaToken:'invalid-'+i},''));assert.equal((await api.POST(request({...draft,captchaToken:'final'},''))).status,429);
});

test('Most searched attorney charts return only the first 20 ranked attorneys',async()=>{
 const x=await runtime(),now=new Date().toISOString();for(let i=0;i<25;i++){const bar=String(100000+i);x.seed(bar,'Attorney '+String(i).padStart(2,'0'));for(let j=0;j<25-i;j++)x.sql.prepare('INSERT INTO attorney_search_events VALUES(?,?,?)').run('rank-'+i+'-'+j,bar,now);}const charts=await x.load('app/api/attorneys/charts.ts'),data=await charts.discoveryData(x.db);for(const list of [data.weekly,data.monthly]){assert.equal(list.length,20);assert.equal(list[0].bar_number,'100000');assert.equal(list[19].bar_number,'100019');assert.equal(list[19].rank,20);}
});

test('Administrator approval publishes suggested attorneys immediately and admin photos do not falsely mark a profile as claimed',async()=>{
 const x=await runtime(),api=await x.load('app/api/directory-submissions/route.ts'),photos=await x.load('app/api/profile-photo/route.ts'),profiles=await x.load('app/api/profiles/route.ts');
 const submitted=await(await api.POST(request({action:'submit',kind:'lawyer',name:'Florida Test Attorney',state:'FL',barNumber:'1001234',city:'Tampa',firmName:'Test Florida Law',officialSourceUrl:'https://example.test/licensing',submitterName:'Test Submitter',submitterEmail:'submitter@example.test'},''))).json();
 const bytes=new Uint8Array(32);bytes.set([137,80,78,71,13,10,26,10]);function upload(user,email){const form=new FormData();form.set('submission',submitted.id);form.set('photo',new File([bytes],'photo.png',{type:'image/png'}));return new Request('https://lawvetter.test/api/profile-photo',{method:'POST',headers:{Origin:'https://lawvetter.test','oai-authenticated-user-id':user,'oai-authenticated-user-email':email},body:form});}
 assert.equal((await photos.POST(upload('other','other@example.test'))).status,403);assert.equal((await photos.POST(upload('admin','admin@example.test'))).status,200);
 assert.equal((await api.POST(request({action:'review',id:submitted.id,decision:'approve',officiallyVerified:true,barStatus:'Active Member in Good Standing'},'admin','admin@example.test'))).status,200);
 const attorney=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get('FL:1001234');assert.equal(attorney.state,'FL');const profile=x.sql.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get('FL:1001234');assert.equal(profile.owner_id,'');assert.equal(profile.claimed_at,'');assert.ok(profile.photo_key);
 const directory=await x.load('app/api/attorneys/route.ts'),search=await(await directory.POST(request({q:'Florida Test Attorney',statusGroup:'active'}))).json();assert.equal(search.total,1);assert.equal(search.attorneys[0].state,'FL');assert.equal((await photos.GET(new Request('https://lawvetter.test/api/profile-photo?bar=FL:1001234'))).status,200);
 assert.equal((await photos.POST(upload('admin','admin@example.test'))).status,200);
 assert.equal((await profiles.POST(request({action:'claim',bar:'FL:1001234',fullName:'Florida Test Attorney',verification:'Official firm biography and independent verification.',attestation:true},'attorney','attorney@example.test'))).status,200);const claim=x.sql.prepare('SELECT id FROM profile_claims WHERE bar_number=?').get('FL:1001234');assert.equal((await profiles.POST(request({action:'review',id:claim.id,decision:'approve',verified:true},'admin','admin@example.test'))).status,200);const owned=x.sql.prepare('SELECT * FROM attorney_profiles WHERE bar_number=?').get('FL:1001234');assert.equal(owned.owner_id,'attorney');assert.ok(owned.claimed_at);assert.ok(owned.photo_key);
});

test('Publication repair imports only already-approved Florida listings with matching active official records',async()=>{
 const x=await runtime({fetch:async()=>new Response('<h1>Approved Test Attorney</h1> Bar Number: 1001234 Member in Good Standing Eligible to Practice Law in Florida')});const now=new Date().toISOString();for(const [id,status,reviewed] of [['approved','approved_for_import','admin'],['pending','pending','']])x.sql.prepare('INSERT INTO directory_submissions(id,kind,name,state,bar_number,official_source_url,submitter_name,submitter_email,status,submitted_at,reviewed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,'lawyer','Approved Test Attorney','FL','1001234','https://www.floridabar.org/directories/find-mbr/profile/?num=1001234','Submitter','submitter@example.test',status,now,reviewed);
 const api=await x.load('app/api/directory-submissions/route.ts');assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,1);assert.equal(x.sql.prepare('SELECT status FROM directory_submissions WHERE id=?').get('pending').status,'pending');assert.equal(x.sql.prepare('SELECT status FROM directory_submissions WHERE id=?').get('approved').status,'published');assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,0);
});

test('The specific historical listing repair still requires a saved administrator approval and preserves all other records',async()=>{
 const x=await runtime({fetch:async()=>new Response('Blocked',{status:403})}),repair=await x.load('db/approved-listing-repairs.ts');const r=repair.approvedListingRepair,now=new Date().toISOString();x.seed('100001','Existing Attorney');x.sql.prepare('INSERT INTO directory_submissions(id,kind,name,state,bar_number,official_source_url,submitter_name,submitter_email,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(r.id,'lawyer',r.name,r.state,r.bar,'https://www.floridabar.org/directories/find-mbr/profile/?num='+r.bar,'Submitter','submitter@example.test','pending',now);const api=await x.load('app/api/directory-submissions/route.ts');assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,0);x.sql.prepare("UPDATE directory_submissions SET status='approved_for_import',reviewed_by='admin' WHERE id=?").run(r.id);assert.equal((await(await api.POST(request({action:'publish-approved-records'},''))).json()).published,1);assert.equal(x.sql.prepare('SELECT state FROM attorneys WHERE bar_number=?').get('FL:'+r.bar).state,'FL');assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('100001').name,'Existing Attorney');
});

test('State names and abbreviations search Florida records with pagination and intersect city and practice filters',async()=>{
 const x=await runtime();for(let i=0;i<30;i++){const bar=String(700000+i);x.seed(bar,'Example Attorney '+i);x.sql.prepare("UPDATE attorneys SET state='FL',city=? WHERE bar_number=?").run(i<26?'Miami':'Tampa',bar);}x.seed('900000','Florida Named Georgia Attorney');
 const api=await x.load('app/api/attorneys/route.ts');
 for(const query of ['q=Florida','q=FL','city=Florida','city=fl']){const result=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?'+query+'&statusGroup=active'))).json();assert.equal(result.total,30);assert.equal(result.attorneys.length,25);assert.ok(result.attorneys.every(a=>a.state==='FL'));}
 const second=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=Florida&page=2'))).json();assert.equal(second.attorneys.length,5);
 const city=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=Florida&city=Miami'))).json();assert.equal(city.total,26);
 const practice=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q=Florida&practice=family-law'))).json();assert.equal(practice.total,0);
});

test('Unified text search recognizes practice categories and retains firm and license searches',async()=>{
 const x=await runtime();x.seed('004170','Randall M Kessler');x.seed('900010','Other Attorney');x.sql.prepare("UPDATE attorneys SET company='Example Family Law Firm' WHERE bar_number='900010'").run();const api=await x.load('app/api/attorneys/route.ts');
 for(const q of ['family law','Family Law','family-law']){const result=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q='+encodeURIComponent(q)))).json();assert.equal(result.total,1);assert.equal(result.attorneys[0].bar_number,'004170');}
 for(const q of ['Example Family Law Firm','900010']){const result=await(await api.GET(new Request('https://lawvetter.test/api/attorneys?q='+encodeURIComponent(q)))).json();assert.equal(result.total,1);assert.equal(result.attorneys[0].bar_number,'900010');}
});
