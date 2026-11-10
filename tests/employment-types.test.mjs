import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime,adminTestCookie} from './employment-runtime.mjs';

test('All three employment types add, edit, save, search and rank while retaining identity and contact details',async()=>{
 const x=await runtime(),admin=await x.load('app/api/admin/records/route.ts'),api=await x.load('app/api/attorneys/route.ts'),labels=await x.load('app/employment.ts');
 const types=['Law Firm Attorney','In House Counsel','Government Attorney'];
 const post=record=>admin.POST(new Request('https://lawvetter.test/api/admin/records',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:adminTestCookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'attorneys',record})}));
 for(const [i,type] of types.entries()){
  const record={_new:1,name:'Example '+['Firm','Corporate','Government'][i]+' Attorney',state:['GA','FL','NY'][i],city:['Atlanta','Miami','New York'][i],barNumber:String(700001+i),sourceUrl:'https://example.test/bar/'+i,status:'Member in Good Standing',employmentType:type,company:'Example Legal',employerName:'Example Organization '+i,employerWebsite:'https://employer.example/',phone:'4045551212',email:'lawyer@example.test',website:'https://attorney.example/',practiceAreas:'Family Law'};
  const response=await post(record),data=await response.json();assert.equal(response.status,200,JSON.stringify(data));
  const id=data.id,row=x.sql.prepare('SELECT * FROM attorneys WHERE bar_number=?').get(id);assert.equal(row.employment_type,type);assert.equal(row.company,i===0?'Example Legal':'');assert.equal(row.employer_name,i===0?'':'Example Organization '+i);assert.equal(row.phone,record.phone);assert.equal(row.email,record.email);
  const eventDate=new Date().toISOString();x.sql.prepare('INSERT INTO attorney_search_events(event_id,bar_number,created_at) VALUES(?,?,?)').run('employment-test-'+i,id,eventDate);
  const edit=await post({...record,_new:0,_id:id,employerName:'Edited Organization '+i});assert.equal(edit.status,200,await edit.text());
  assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM attorney_search_events WHERE bar_number=?').get(id).n,1);
  const search=await api.GET(new Request('https://lawvetter.test/api/attorneys?q='+encodeURIComponent(record.name)+'&kind=attorneys'));assert.equal(search.status,200,await search.clone().text());const found=(await search.json()).attorneys[0];assert.equal(found.employment_type,type);assert.match(labels.employmentLabel(found),new RegExp(type));
  const profile=await api.GET(new Request('https://lawvetter.test/api/attorneys?id='+encodeURIComponent(id)));assert.equal(profile.status,200);const full=(await profile.json()).attorney;assert.equal(full.phone,record.phone);assert.equal(full.email,record.email);assert.equal(full.employer_website,i===0?'':'https://employer.example/');
 }
 const charts=await x.load('app/api/attorneys/charts.ts');const ranks=x.sql.prepare(charts.attorneyChartSQL).all('2000-01-01','2100-01-01');assert.equal(ranks.length,3);
 const invalid=await post({_new:1,name:'Bad Type',state:'GA',city:'Atlanta',barNumber:'700004',status:'Member in Good Standing',employmentType:'Other'});assert.equal(invalid.status,400);
 x.sql.close();
});

test('Verified employer reclassification preserves records and histories, excludes organizations from firm results, and is repeatable',async()=>{
 const x=await runtime();x.seed('700011','Example Corporate Attorney','The Coca-Cola Company');x.seed('700012','Example Government Attorney','Georgia Department of Law');x.seed('700013','Example Firm Attorney','Actual Legal LLC');
 x.sql.exec("INSERT INTO firm_settings(key,name,website,updated_at) VALUES('thecocacolacompany','The Coca-Cola Company','https://corporate.example/','now'); INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,bio) VALUES('700011','owner','claimed','now','Keep biography'); INSERT INTO attorney_search_events VALUES('original-event','700011','2026-11-03'); INSERT INTO firm_search_events VALUES('firm-event','thecocacolacompany','The Coca-Cola Company','2026-11-03');");
 const audit=await x.load('db/employer-classification.ts');assert.equal(await audit.reclassifyVerifiedEmployers(x.db),2);assert.equal(await audit.reclassifyVerifiedEmployers(x.db),0);
 assert.equal(x.sql.prepare('SELECT count(*) AS n FROM attorneys').get().n,3);assert.equal(x.sql.prepare('SELECT bio FROM attorney_profiles').get().bio,'Keep biography');assert.equal(x.sql.prepare('SELECT count(*) AS n FROM attorney_search_events').get().n,1);assert.equal(x.sql.prepare('SELECT count(*) AS n FROM firm_search_events').get().n,1);
 const row=x.sql.prepare("SELECT * FROM attorneys WHERE bar_number='700011'").get();assert.equal(row.owner_edited,0);assert.equal(row.employer_name,'The Coca-Cola Company');assert.equal(row.company,'');assert.equal(row.employer_website,'https://corporate.example/');
 const api=await x.load('app/api/attorneys/route.ts');const response=await api.GET(new Request('https://lawvetter.test/api/attorneys?kind=firms&q=Coca'));assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).total,0);
 assert.equal((await api.GET(new Request('https://lawvetter.test/api/attorneys?firm=The%20Coca-Cola%20Company'))).status,404);
 assert.equal(x.sql.prepare("SELECT count(*) AS n FROM site_settings WHERE key LIKE 'employer-reclassification:%'").get().n,2);x.sql.close();
});

test('Spreadsheet previews and saves both reject unverified new memberships',async()=>{
 const x=await runtime(),api=await x.load('app/api/admin/spreadsheet/route.ts');
 for(const preview of [true,false]){
  const r=await api.POST(new Request('https://lawvetter.test/api/admin/spreadsheet',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:adminTestCookie},body:JSON.stringify({preview,rows:[{name:'Unverified Attorney',barNumber:'700021',city:'Atlanta',state:'GA',photoKey:'https://example.test/photo.jpg'}]})}));
  assert.equal(r.status,200);const data=await r.json();assert.equal(data.created,0);assert.equal(data.results[0].ok,false);assert.match(data.results[0].error,/Verify active membership/);
 }
 assert.equal(x.sql.prepare('SELECT count(*) n FROM attorneys').get().n,0);x.sql.close();
});

test('Reclassified attorneys do not reappear in a previously sourced law firm roster',async()=>{
 const x=await runtime();x.seed('004170','Previously Listed Attorney','The Coca-Cola Company');
 await (await x.load('db/employer-classification.ts')).reclassifyVerifiedEmployers(x.db);
 const api=await x.load('app/api/attorneys/route.ts');
 assert.equal((await api.GET(new Request('https://lawvetter.test/api/attorneys?firm=Kessler%20%26%20Solomiany%20LLC'))).status,404);
 assert.equal(x.sql.prepare("SELECT employment_type FROM attorneys WHERE bar_number='004170'").get().employment_type,'In House Counsel');x.sql.close();
});
