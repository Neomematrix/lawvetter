import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './employment-runtime.mjs';

test('Nickname and typo search works in autocomplete and results with filters and exact priority',async()=>{
 const x=await runtime();
 x.seed('10','Theodore Scott Eittreim','');
 x.seed('11','Ted Eittreim','');
 x.seed('12','Robert James Jones','');
 x.seed('13','Theodore Wrong','');
 x.sql.prepare("UPDATE attorneys SET city='Atlanta'").run();
 const api=await x.load('app/api/attorneys/route.ts');
 const get=async q=>{const r=await api.GET(new Request('https://lawvetter.test/api/attorneys?'+new URLSearchParams(q)));assert.equal(r.status,200);return r.json();};
 try {
  for(const suggest of ['0','1']){
   let r=await get({q:'Ted Eittreim',kind:'attorneys',suggest});
   assert.deepEqual(r.attorneys.map(a=>a.name),['Ted Eittreim','Theodore Scott Eittreim']);
   r=await get({q:'Ted Ettreim',kind:'attorneys',suggest});
   assert.ok(r.attorneys.some(a=>a.name==='Theodore Scott Eittreim'));
   r=await get({q:'Bob Jones',kind:'attorneys',suggest});
   assert.deepEqual(r.attorneys.map(a=>a.name),['Robert James Jones']);
   r=await get({q:'Theodore Eittreim',kind:'attorneys',suggest});
   assert.equal(r.attorneys[0].name,'Theodore Scott Eittreim');
   r=await get({q:'Ted Eittreim',kind:'attorneys',suggest,city:'Macon'});
   assert.equal(r.attorneys.length,0);
   r=await get({q:'Ted Missing',kind:'attorneys',suggest});
   assert.equal(r.attorneys.length,0);
  }
  x.db.batch=async()=>{throw new Error('D1 candidate lookup unavailable');};
  const fallback=await get({q:'Ted Eittreim',kind:'attorneys'});
  assert.ok(fallback.attorneys.some(a=>a.name==='Ted Eittreim'),'Optional matching failure preserves direct search');
 }finally{x.sql.close();}
});
