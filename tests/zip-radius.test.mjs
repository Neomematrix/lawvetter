import {runtime} from './employment-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const radiusCode=fs.readFileSync('app/search-radius.ts','utf8');
const source=radiusCode+'\n'+fs.readFileSync('db/zip-radius.ts','utf8').replace("import coordinates from '../data/us-zip-coordinates.json';",'const coordinates='+fs.readFileSync('data/us-zip-coordinates.json','utf8')+';').replace("import {searchRadius} from '../app/search-radius';",'');
const radius=await import('data:text/javascript;base64,'+Buffer.from(transpile(source)).toString('base64'));
test('ZIP radius defaults to 50 miles and supports progressively smaller distances, ZIP+4 and leading zeros',()=>{
 const all=radius.zipRadius('30127'),small=radius.zipRadius('30127',5);
 assert.equal(all['30127'],0);assert.ok('30303' in all);assert.ok(!('31401' in all));assert.ok(!('30303' in small));
 for(const miles of [5,10,25,50]){const matches=radius.zipRadius('30127',miles);assert.ok(Object.values(matches).every(distance=>distance<=miles));assert.ok(Object.keys(matches).every(zip=>zip in all));}
 assert.equal(radius.searchRadius('-1'),-1);assert.ok('31401' in radius.zipRadius('30127',-1));
 assert.deepEqual(radius.zipRadius('30127-1234'),all);assert.equal(radius.zipRadius('00501')['00501'],0);
 assert.ok('37402' in radius.zipRadius('30741')); // Nearby offices can cross state lines.
 for(const value of [undefined,'bad',0,1000])assert.equal(radius.searchRadius(value),50);
 assert.throws(()=>radius.zipRadius('00000'),/could not be located/);assert.throws(()=>radius.zipRadius('123'),/valid/);
 assert.ok(Math.abs(radius.distanceMiles([0,0],[0,1])-69.09)<.1);
});

test('ZIP search API applies radius before totals and pagination, orders by distance and honors practice and status',async()=>{
 const x=await runtime(),sqlite=x.sql;
 for(let i=0;i<30;i++){x.seed(String(i),'Attorney '+i,'Firm');sqlite.prepare('UPDATE attorneys SET zip=?,owner_edited=1 WHERE bar_number=?').run(i<2?'30127':i<28?'30303':'31401',String(i));sqlite.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,practice_areas) VALUES(?,'','','',?)").run(String(i),i===1?'Business law':'Family law');}
 sqlite.prepare("UPDATE attorneys SET status='Inactive' WHERE bar_number='2'").run();
 const mod={namespace:await x.load('app/api/attorneys/route.ts')};
 try{
  const get=async params=>{const r=await mod.namespace.GET(new Request('https://lawvetter.test/api/attorneys?'+new URLSearchParams(params)));return {status:r.status,...await r.json()};};
  let result=await get({zip:'30127',practice:'family-law',statusGroup:'active'});assert.equal(result.total,26);assert.equal(result.attorneys.length,24);assert.equal(result.attorneys[0].name,'Attorney 0');
  let second=await get({zip:'30127',practice:'family-law',statusGroup:'active',page:'2'});assert.equal(second.attorneys.length,2);assert.ok(!second.attorneys.some(a=>result.attorneys.some(b=>a.bar_number===b.bar_number)));
  result=await get({zip:'30127',radius:'5',practice:'family-law'});assert.equal(result.total,1);assert.equal(result.attorneys[0].zip,'30127');
  const r=await mod.namespace.POST(new Request('https://lawvetter.test/api/attorneys',{method:'POST',headers:{origin:'https://lawvetter.test','Content-Type':'application/json'},body:JSON.stringify({zip:'30127',radius:5,page:1})}));assert.equal(r.status,200);assert.equal((await r.json()).total,2);
  assert.equal((await get({zip:'00000'})).status,400);
  x.seed('missing-zip','No ZIP attorney','Firm');
  const unlimited=await get({zip:'30127',radius:'-1'});assert.equal(unlimited.total,30);
  const allFamily=await get({zip:'30127',radius:'-1',practice:'family-law'});assert.equal(allFamily.total,28);
  const unbounded=await get({radius:'-1'});assert.equal(unbounded.total,30);
 }finally{sqlite.close();}
});
