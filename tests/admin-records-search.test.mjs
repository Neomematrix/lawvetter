import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime,adminTestCookie} from './employment-runtime.mjs';

test('Admin search completes against 90,000 records without category maintenance or a redundant count',async()=>{
 const x=await runtime();
 try{
  x.sql.exec('BEGIN');
  for(let i=0;i<90000;i++)x.seed(String(i),'Example Person '+i,'Example Legal LLC');
  x.seed('target','J. Deborah Wood Temples','Wendt & Temples LLC');
  x.sql.exec('COMMIT');
  const prepare=x.db.prepare.bind(x.db),queries=[];
  x.db.prepare=text=>{queries.push(text);if(text.includes('site_settings'))throw Error('Category maintenance must not block directory reads');return prepare(text);};
  const api=await x.load('app/api/admin/records/route.ts');
  const search=async q=>{
   queries.length=0;
   const start=performance.now();
   const response=await api.GET(new Request('https://lawvetter.test/api/admin/records?'+new URLSearchParams({kind:'attorneys',q}),{headers:{cookie:adminTestCookie}}));
   assert.equal(response.status,200);
   const result=await response.json();
   console.log('Admin search '+JSON.stringify(q)+': '+Math.round(performance.now()-start)+'ms');
   assert.ok(!queries.some(sql=>sql.startsWith('SELECT COUNT(*) AS count FROM attorneys')));
   return result;
  };
  for(const q of ['Deborah Wood Temples','deborah temples','Wendt Temples']){
   const result=await search(q);
   assert.equal(result.total,1);assert.equal(result.records[0].name,'J. Deborah Wood Temples');
  }
  const empty=await search('Definitely Missing');assert.equal(empty.total,0);assert.deepEqual(empty.records,[]);
 }finally{x.sql.close();}
});
