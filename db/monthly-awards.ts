import {attorneyRankingActivitySQL} from './ranking-activity';
import {rawDb} from './raw';
import {activeMembershipSQL} from './active-membership';
import {attorneyPath} from '../app/seo';
import {AWARDS_START,currentMonth,nextMonth,monthBoundary,validMonth,type Award} from '../app/awards/core';
async function finalize(db:D1Database,now:Date){
 const current=currentMonth(now);
 const existing=await db.prepare('SELECT month FROM monthly_awards').all<{month:string}>();
 const done=new Set(existing.results.map(x=>x.month));
 for(let month=AWARDS_START;month<current;month=nextMonth(month)){
  if(done.has(month))continue;
  const winner=await db.prepare(`SELECT a.bar_number,a.public_id,a.name,a.company,a.city,a.state,count(*) AS searches FROM (${attorneyRankingActivitySQL}) e JOIN attorneys a ON a.bar_number=e.bar_number WHERE e.created_at>=? AND e.created_at<? AND ${activeMembershipSQL('a')} GROUP BY a.bar_number ORDER BY searches DESC,a.name COLLATE NOCASE,a.bar_number LIMIT 1`).bind(monthBoundary(month),monthBoundary(nextMonth(month))).first<{bar_number:string;public_id:string;name:string;company:string;city:string;state:string;searches:number}>();
  const finalizedAt=now.toISOString();
  const award:Award|null=winner?{month,name:winner.name,firm:winner.company||'',city:winner.city||'',state:winner.state||'',profilePath:attorneyPath(winner),searches:winner.searches,finalizedAt,methodVersion:1}:null;
  // No foreign key: historical awards survive profile edits and removal. First finalization wins.
  await db.prepare('INSERT OR IGNORE INTO monthly_awards(month,payload,finalized_at) VALUES(?,?,?)').bind(month,award?JSON.stringify(award):null,finalizedAt).run();
 }
}
export async function awardArchive(){const db=rawDb();await finalizeClosedAwards(db);const rows=await db.prepare('SELECT month,payload,finalized_at FROM monthly_awards ORDER BY month DESC').all<{month:string;payload:string|null;finalized_at:string}>();return rows.results.map(r=>({month:r.month,award:r.payload?JSON.parse(r.payload) as Award:null}));}
export async function monthlyAward(month:string){if(!validMonth(month)||month>=currentMonth())return null;const db=rawDb();await finalizeClosedAwards(db);const row=await db.prepare('SELECT payload FROM monthly_awards WHERE month=?').bind(month).first<{payload:string|null}>();return row?.payload?JSON.parse(row.payload) as Award:null;}

// Closed awards are immutable. Check once per Eastern month per isolate, and
// share in-flight finalization so concurrent visitors cannot recompute a winner.
const finalizers=new WeakMap<D1Database,{month:string;pending:Promise<void>}>();
export function finalizeClosedAwards(db=rawDb(),now=new Date()){
 const month=currentMonth(now),existing=finalizers.get(db);
 if(existing?.month===month)return existing.pending;
 const state={month,pending:Promise.resolve()};
 state.pending=(existing?existing.pending.catch(()=>{}):Promise.resolve()).then(()=>finalize(db,now)).catch(error=>{if(finalizers.get(db)===state)finalizers.delete(db);throw error;});
 finalizers.set(db,state);return state.pending;
}
