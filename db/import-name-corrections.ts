import {rawDb} from './raw';
import {normalizeBarNumber} from '../app/attorney-identity';

// Limit the repair to records created by this administrator during this import.
// An older profile, an intervening name edit, or a claimed profile is untouched.
const startedAt='2026-11-05T22:05:00.000Z';
const cohort="imported_at>=? AND source_id LIKE 'admin:%' AND EXISTS(SELECT 1 FROM admin_audit c WHERE c.action='attorney-create' AND c.record_id=attorneys.bar_number AND c.actor=? AND c.created_at>=?) AND NOT EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=attorneys.bar_number AND (COALESCE(p.owner_id,'')<>'' OR COALESCE(p.claimed_at,'')<>''))";
type Correction={id:string;bar:string;name:string;previousName:string};
export async function correctImportedNames(input:unknown[],actor:string,preview:boolean){
 const seen=new Set<string>(),rows:Correction[]=input.map(value=>{
  if(!value||typeof value!=='object')throw Error('Invalid name correction.');
  const r=value as Record<string,unknown>;
  if(r.state!=='FL'||typeof r.barNumber!=='string'||typeof r.name!=='string'||typeof r.previousName!=='string'||!r.name.trim()||!r.previousName.trim()||r.name.length>500||r.previousName.length>500)throw Error('Provide state, bar number, first and last name, and the previous attorney name.');
  const bar=normalizeBarNumber('FL',r.barNumber),id='FL:'+bar;if(seen.has(id))throw Error('A name correction appears more than once.');seen.add(id);
  return {id,bar,name:r.name.trim(),previousName:r.previousName.trim()};
 });
 const db=rawDb(),expected=new Map(rows.map(r=>[r.id,r]));
 // Drive the read from the primary keys, rather than joining every attorney
 // against the JSON correction payload. Compare the expected names in memory.
 const eligible=await db.prepare("SELECT bar_number,name,state FROM attorneys WHERE bar_number IN (SELECT value FROM json_each(?)) AND "+cohort).bind(JSON.stringify(rows.map(r=>r.id)),startedAt,actor,startedAt).all<{bar_number:string;name:string;state:string}>();
 const allowed=new Set(eligible.results.filter(r=>r.state==='FL'&&r.name===expected.get(r.bar_number)?.previousName&&r.name!==expected.get(r.bar_number)?.name).map(r=>r.bar_number)),results=rows.map(r=>({name:r.name,bar:r.bar,ok:true,skipped:!allowed.has(r.id)}));
 if(preview)return {created:0,updated:allowed.size,skipped:rows.length-allowed.size,withoutPhoto:0,results};
 const statements:ReturnType<typeof db.prepare>[]=[],pending:Correction[]=[];
 const now=new Date().toISOString();
 for(const r of rows){if(!allowed.has(r.id))continue;pending.push(r);
  statements.push(db.prepare("UPDATE attorneys SET name=? WHERE bar_number=? AND state='FL' AND name=? AND "+cohort).bind(r.name,r.id,r.previousName,startedAt,actor,startedAt));
  statements.push(db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'attorney-name-update',?,? WHERE changes()>0").bind(crypto.randomUUID(),actor,r.id,now));
 }
 const saved=statements.length?await db.batch(statements):[];let updated=0;
 for(let i=0;i<pending.length;i++){const changed=!!saved[i*2].meta.changes;results[rows.findIndex(r=>r.id===pending[i].id)].skipped=!changed;if(changed)updated++;}
 return {created:0,updated,skipped:rows.length-updated,withoutPhoto:0,results};
}
