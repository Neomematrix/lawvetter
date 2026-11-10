import {judicialRollbackBars} from './judicial-category-rollback-targets';
import {practiceCategoryId} from '../app/practice-category';

const key='judge-category-rollback-2026-10-18';
let complete=false;
let pending:Promise<void>|undefined;
export async function ensureJudicialCategoryRollback(db:D1Database){
 if(complete)return;
 if(pending)return pending;
 pending=rollback(db).finally(()=>{pending=undefined;});
 return pending;
}
async function rollback(db:D1Database){
 const existing=await db.prepare('SELECT value FROM site_settings WHERE key=?').bind(key).first<{value:string}>();
 if(existing){const state=JSON.parse(existing.value);if(state.status==='complete'){complete=true;return;}if(Date.now()-state.started<300000)return;}
 const original=await db.prepare('SELECT value FROM site_settings WHERE key=?').bind('judge-category-backfill-2026-10-18').first<{value:string}>();
 if(!original||JSON.parse(original.value).status!=='complete')return;
 const owner=crypto.randomUUID(),now=new Date().toISOString(),claim=JSON.stringify({status:'running',owner,started:Date.now()});
 const lock=await db.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE json_extract(site_settings.value,'$.status')='running' AND json_extract(site_settings.value,'$.started')<?").bind(key,claim,now,Date.now()-300000).run();
 if(!lock.meta.changes)return;
 try{
  const {results}=await db.prepare('SELECT bar_number,practice_areas FROM attorney_profiles WHERE bar_number IN (SELECT value FROM json_each(?))').bind(JSON.stringify(judicialRollbackBars)).all<{bar_number:string;practice_areas:string}>();
  let removed=0,alreadyRemoved=judicialRollbackBars.length-results.length;
  const changes:D1PreparedStatement[]=[];
  for(const row of results){
   const areas=row.practice_areas.split(/[,;|\n]+/).map(area=>area.trim()).filter(Boolean);
   if(!areas.some(area=>practiceCategoryId(area)==='judge')){alreadyRemoved++;continue;}
   const restored=areas.filter(area=>practiceCategoryId(area)!=='judge').join(', ');
   changes.push(db.prepare('UPDATE attorney_profiles SET practice_areas=?,updated_at=? WHERE bar_number=? AND practice_areas=?').bind(restored,now,row.bar_number,row.practice_areas));
  }
  for(let i=0;i<changes.length;i+=50){const applied=await db.batch(changes.slice(i,i+50));removed+=applied.reduce((sum,r)=>sum+(r.meta.changes||0),0);}
  if(removed!==changes.length)throw Error('A practice area changed during rollback; retrying will preserve the latest edit.');
  await db.prepare('UPDATE site_settings SET value=?,updated_at=? WHERE key=? AND value=?').bind(JSON.stringify({status:'complete',checked:judicialRollbackBars.length,removed,alreadyRemoved,completedAt:now}),now,key,claim).run();
  complete=true;
 }catch(error){await db.prepare('DELETE FROM site_settings WHERE key=? AND value=?').bind(key,claim).run();throw error;}
}
