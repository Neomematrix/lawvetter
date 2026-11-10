import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as nodeCrypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {webcrypto}=nodeCrypto,root=path.resolve('.'),adminTestToken='ab'.repeat(32),adminTestCookie='__Host-lawvetter-admin='+adminTestToken;
function database(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));const db={prepare(text){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){const x=sql.prepare(text).run(...args);return {meta:{changes:Number(x.changes)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {sql,db};}
async function runtime(options={}){const {sql,db}=database(),files=new Map();sql.prepare('INSERT INTO admin_credentials(email,password_hash,updated_at) VALUES(?,?,?)').run('admin@example.test','fixture-only','2026-01-01');sql.prepare('INSERT INTO admin_sessions(token_hash,email,expires_at,last_seen) VALUES(?,?,?,?)').run(nodeCrypto.createHash('sha256').update(adminTestToken).digest('hex'),'admin@example.test',Date.now()+3600000,Date.now());const env={DB:db,CLAIM_ADMIN_EMAIL:'admin@example.test',PROFILE_PHOTOS:{async put(key,buffer,metadata){files.set(key,{body:buffer,...metadata});},async get(key){return files.get(key)},async delete(key){files.delete(key)}}};const context=vm.createContext({structuredClone,setTimeout,clearTimeout,console,Request,Response,URL,File,FormData,Uint8Array,Buffer,Date,Intl,TextEncoder,TextDecoder,btoa,atob,crypto:webcrypto,AbortSignal,fetch:options.fetch});const cache=new Map();async function module(file){if(cache.has(file))return cache.get(file);if(file.endsWith('.json.ts')){const m=new vm.SyntheticModule(['default'],function(){this.setExport('default',JSON.parse(fs.readFileSync(file.slice(0,-3),'utf8')))},{context});cache.set(file,m);return m;}if(file==='node:crypto'){const m=new vm.SyntheticModule(Object.keys(nodeCrypto),function(){for(const [k,v] of Object.entries(nodeCrypto))this.setExport(k,v)},{context});cache.set(file,m);return m;}if(file==='cloudflare:workers'){const m=new vm.SyntheticModule(['env'],function(){this.setExport('env',env)},{context});cache.set(file,m);return m;}const text=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const m=new vm.SourceTextModule(text,{context,identifier:file});cache.set(file,m);return m;}async function load(file){const m=await module(path.join(root,file));if(m.status==='unlinked')await m.link(async(spec,parent)=>module((spec==='cloudflare:workers'||spec==='node:crypto')?spec:path.resolve(path.dirname(parent.identifier),spec)+'.ts'));if(m.status!=='evaluated')await m.evaluate();return m.namespace;}function seed(bar,name,company='Example Legal LLC',status='Active Member in Good Standing'){sql.prepare('INSERT INTO attorneys(bar_number,source_id,name,company,city,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)').run(bar,bar,name,company,'Atlanta',status,'https://example.test/record','2026-10-08T00:00:00Z');}return {sql,db,load,seed,files,env};}

test('firm offices save, reload, publish, survive renaming and can be removed',async()=>{
 const x=await runtime(),admin=await x.load('app/api/admin/records/route.ts'),publicApi=await x.load('app/api/attorneys/route.ts');
 const location={address:'200 Second Street',city:'Dallas',state:'TX',zip:'75201',phone:'214-555-0123',email:'dallas@example.com'};
 const post=record=>admin.POST(new Request('https://lawvetter.test/api/admin/records',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:adminTestCookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'firms',record})}));
 const record={_new:1,name:'Multiple Offices Test',website:'https://example.com',address:'100 Main Street',city:'Houston',state:'TX',zip:'77002',additional_locations:JSON.stringify([location,{...location,address:'300 Third Street',city:'Austin',zip:'78701'}])};
 const response=await post(record);assert.equal(response.status,200,JSON.stringify(await response.json()));x.seed('700001','Test Lawyer','Multiple Offices Test');
 const list=await admin.GET(new Request('https://lawvetter.test/api/admin/records?kind=firms&q=Multiple',{headers:{cookie:adminTestCookie}}));assert.equal(list.status,200);const data=await list.json();assert.equal(data.records.length,1);assert.equal(JSON.parse(data.records[0].additional_locations).length,2);assert.equal(JSON.parse(data.records[0].additional_locations)[0].city,'Dallas');
 const publicResponse=await publicApi.GET(new Request('https://lawvetter.test/api/attorneys?firm=Multiple%20Offices%20Test'));assert.equal(publicResponse.status,200);const published=await publicResponse.json();assert.equal(published.firm.address,record.address);assert.deepEqual(published.firm.cities,['Houston','Dallas','Austin']);assert.equal(published.firm.additionalLocations.length,2);assert.equal(published.firm.additionalLocations[0].phone,location.phone);
 const {additional_locations,...legacy}=record;assert.equal((await post({...legacy,_new:0,key:'multipleofficestest',name:'Renamed Offices Test'})).status,200);assert.equal(JSON.parse(x.sql.prepare('SELECT additional_locations FROM firm_settings WHERE key=?').get('renamedofficestest').additional_locations).length,2);
 assert.equal((await post({...record,_new:0,key:'renamedofficestest',name:'Renamed Offices Test',additional_locations:'[]'})).status,200);assert.equal(x.sql.prepare('SELECT additional_locations FROM firm_settings WHERE key=?').get('renamedofficestest').additional_locations,'[]');
 x.sql.close();
});
test('invalid additional offices are rejected before the firm is saved',async()=>{const x=await runtime(),api=await x.load('app/api/admin/records/route.ts');for(const extra of ['bad json',JSON.stringify([{address:'Street',city:'City',state:'XX'}]),JSON.stringify([{address:'Street',city:'City',state:'TX',zip:'bad'}]),JSON.stringify([{address:'Street',city:'City',state:'TX',email:'bad'}])]){const response=await api.POST(new Request('https://lawvetter.test/api/admin/records',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:adminTestCookie},body:JSON.stringify({kind:'firms',record:{_new:1,name:'Invalid Offices',additional_locations:extra}})}));assert.equal(response.status,400);assert.equal(x.sql.prepare('SELECT count(*) n FROM firm_settings').get().n,0);}x.sql.close();});

test('attorney editor saves shared firm offices atomically, preserves other firm fields, and omits untouched offices',async()=>{
 const x=await runtime(),api=await x.load('app/api/admin/records/route.ts');
 x.seed('700001','Test Lawyer');
 x.sql.prepare('INSERT INTO firm_settings(key,name,website,banner_key,address,updated_at) VALUES(?,?,?,?,?,?)').run('examplelegalllc','Example Legal LLC','https://example.com','saved-banner','100 Main Street','2026-01-01');
 const headers={origin:'https://lawvetter.test',cookie:adminTestCookie,'Content-Type':'application/json'};
 const record={_id:'700001',name:'Test Lawyer',barNumber:'700001',state:'GA',city:'Atlanta',company:'Example Legal LLC',status:'Active Member in Good Standing',address:'100 Main Street'};
 const location={address:'200 Second Street',city:'Dallas',state:'TX',zip:'75201',phone:'',email:''};
 const post=patch=>api.POST(new Request('https://lawvetter.test/api/admin/records',{method:'POST',headers,body:JSON.stringify({kind:'attorneys',record:{...record,...patch}})}));
 let response=await post({firmAdditionalLocations:JSON.stringify([location])});assert.equal(response.status,200,JSON.stringify(await response.json()));
 let firm=x.sql.prepare('SELECT * FROM firm_settings WHERE key=?').get('examplelegalllc');assert.equal(JSON.parse(firm.additional_locations)[0].city,'Dallas');assert.equal(firm.address,'100 Main Street');assert.equal(firm.website,'https://example.com');assert.equal(firm.banner_key,'saved-banner');
 const url='https://lawvetter.test/api/admin/records?kind=firm-locations&firm=Example%20Legal%20LLC';
 response=await api.GET(new Request(url,{headers}));assert.equal(response.status,200);assert.equal(JSON.parse((await response.json()).additional_locations).length,1);
 assert.equal((await api.GET(new Request(url))).status,401);
 assert.equal((await post({phone:'404-555-0100'})).status,200);assert.equal(JSON.parse(x.sql.prepare('SELECT additional_locations FROM firm_settings WHERE key=?').get('examplelegalllc').additional_locations).length,1);
 response=await post({name:'Should Not Save',firmAdditionalLocations:'[{"address":"Bad"}]'});assert.equal(response.status,400);assert.equal(x.sql.prepare('SELECT name FROM attorneys WHERE bar_number=?').get('700001').name,'Test Lawyer');
 assert.equal((await post({firmAdditionalLocations:'[]'})).status,200);assert.equal(x.sql.prepare('SELECT additional_locations FROM firm_settings WHERE key=?').get('examplelegalllc').additional_locations,'[]');
 x.sql.close();
});

test('only manual admin editing accepts Retired and the saved record leaves active search results',async()=>{
 const x=await runtime(),api=await x.load('app/api/admin/records/route.ts'),publicApi=await x.load('app/api/attorneys/route.ts'),records=await x.load('db/admin-records.ts');
 x.seed('700002','Retiring Lawyer');
 const record={_id:'700002',recordId:'700002',name:'Retiring Lawyer',barNumber:'700002',state:'GA',city:'Atlanta',company:'Example Legal LLC',status:'Retired'};
 assert.throws(()=>records.validateAttorney(record),/membership status/);
 await assert.rejects(()=>records.saveAttorney(records.validateAttorney(record,true),'import',false,false),/Only verified active/);
 const response=await api.POST(new Request('https://lawvetter.test/api/admin/records',{method:'POST',headers:{origin:'https://lawvetter.test',cookie:adminTestCookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'attorneys',record})}));
 assert.equal(response.status,200,JSON.stringify(await response.json()));assert.equal(x.sql.prepare('SELECT status FROM attorneys WHERE bar_number=?').get('700002').status,'Retired');
 const search=await publicApi.GET(new Request('https://lawvetter.test/api/attorneys?q=Retiring'));assert.equal(search.status,200);assert.doesNotMatch(JSON.stringify(await search.json()),/Retiring Lawyer/);
 const admin=await api.GET(new Request('https://lawvetter.test/api/admin/records?kind=attorneys&q=Retiring',{headers:{cookie:adminTestCookie}}));assert.equal(admin.status,200);assert.equal((await admin.json()).records[0].status,'Retired');
 x.sql.close();
});
