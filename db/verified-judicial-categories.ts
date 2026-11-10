import {verifiedJudges} from './verified-judges-2026-10-20';
import {practiceCategoryId,splitPracticeAreas} from '../app/practice-category';

const key='verified-judge-category-audit-2026-10-20';
const action='verified-judge-category-2026-10-20';
type Backup={bar:string;practiceAreas:string|null};
type Progress={status:'pending'|'running'|'complete';offset:number;started?:number;backups:Backup[];skipped:string[];updated?:number;completedAt?:string};
type Row={bar_number:string;name:string;company:string;state:string;status:string;practice_areas:string|null};
let complete=false;
let pending:Promise<void>|undefined;
const identity=(value:string)=>value.trim().replace(/\s+/g,' ').toLowerCase();

/** One reviewed, resumable cleanup. Never infer Judge from a court employer. */
export async function ensureVerifiedJudicialCategories(db:D1Database){
 if(complete)return;
 if(pending)return pending;
 pending=applyChunk(db).finally(()=>{pending=undefined;});
 return pending;
}

async function applyChunk(db:D1Database){
 const stored=await db.prepare('SELECT value FROM site_settings WHERE key=?').bind(key).first<{value:string}>();
 const state:Progress=stored?JSON.parse(stored.value):{status:'pending',offset:0,backups:[],skipped:[]};
 if(state.status==='complete'){complete=true;return;}
 if(state.status==='running'&&Date.now()-(state.started||0)<300000)return;
 const now=new Date().toISOString(),claim:Progress={...state,status:'running',started:Date.now()};
 let claimValue=JSON.stringify(claim);
 const lock=await db.prepare('INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE site_settings.value=?').bind(key,claimValue,now,stored?.value||'').run();
 if(!lock.meta.changes)return;
 try{
  const targets=verifiedJudges.slice(state.offset,state.offset+100);
  const {results}=await db.prepare('SELECT a.bar_number,a.name,a.company,a.state,a.status,p.practice_areas FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE a.bar_number IN (SELECT value FROM json_each(?))').bind(JSON.stringify(targets.map(row=>row.bar))).all<Row>();
  const rows=new Map(results.map(row=>[row.bar_number,row]));
  const changes:D1PreparedStatement[]=[];
  for(const target of targets){
   const row=rows.get(target.bar);
   if(!row||row.state!=='GA'||identity(row.name)!==identity(target.name)||identity(row.company)!==identity(target.company)||/deceased/i.test(row.status)){
    if(!claim.skipped.includes(target.bar))claim.skipped.push(target.bar);
    continue;
   }
   if(splitPracticeAreas(row.practice_areas||'').some(area=>practiceCategoryId(area)==='judge'))continue;
   if(!claim.backups.some(backup=>backup.bar===target.bar))claim.backups.push({bar:target.bar,practiceAreas:row.practice_areas});
   const next=[(row.practice_areas||'').trim(),'Judge'].filter(Boolean).join(', ');
   // Both the directory identity and latest category must still match at write time.
   changes.push(db.prepare("INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,practice_areas) SELECT a.bar_number,'','',?,? FROM attorneys a WHERE a.bar_number=? AND a.name=? AND a.company=? AND a.state='GA' AND lower(a.status) NOT LIKE '%deceased%' AND NOT EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=a.bar_number AND COALESCE(p.practice_areas,'')<>?) ON CONFLICT(bar_number) DO UPDATE SET practice_areas=excluded.practice_areas,updated_at=excluded.updated_at WHERE COALESCE(attorney_profiles.practice_areas,'')=?").bind(now,next,target.bar,row.name,row.company,row.practice_areas||'',row.practice_areas||''));
   changes.push(db.prepare('INSERT OR IGNORE INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(action+':'+target.bar,'system:owner-authorized-judicial-audit',action,target.bar,now));
  }
  // Persist original categories before changing records, including on retry.
  const backedUp=JSON.stringify(claim);
  await db.prepare('UPDATE site_settings SET value=?,updated_at=? WHERE key=? AND value=?').bind(backedUp,now,key,claimValue).run();
  claimValue=backedUp;
  for(let i=0;i<changes.length;i+=40)await db.batch(changes.slice(i,i+40));
  const offset=state.offset+targets.length,done=offset>=verifiedJudges.length;
  const count=await db.prepare('SELECT COUNT(*) AS count FROM admin_audit WHERE action=?').bind(action).first<{count:number}>();
  const next:Progress={...claim,status:done?'complete':'pending',offset,updated:count?.count||0,...(done?{completedAt:now}:{})};
  const saved=await db.prepare('UPDATE site_settings SET value=?,updated_at=? WHERE key=? AND value=?').bind(JSON.stringify(next),now,key,claimValue).run();
  if(saved.meta.changes&&done){complete=true;console.info('Verified judicial category audit complete',JSON.stringify({checked:verifiedJudges.length,added:next.updated,skipped:next.skipped.length}));}
 }catch(error){
  const retry:Progress={...claim,status:'pending'};
  await db.prepare('UPDATE site_settings SET value=?,updated_at=? WHERE key=? AND value=?').bind(JSON.stringify(retry),now,key,claimValue).run();
  throw error;
 }
}
