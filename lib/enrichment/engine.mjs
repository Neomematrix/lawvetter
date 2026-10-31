import {adapters,adapterVersion,fields} from './sources.mjs';
import {nightlyKey,nextScan} from './time.mjs';
import {researchDb} from './research-db.mjs';
export const identitySQL="json_array(a.name,a.state,COALESCE(a.license_number,a.bar_number),a.source_url)";
const snapshotSQL=`json_array(${['a.name','a.state','a.license_number','a.source_url','a.company','a.admit_date','a.law_school','a.county','a.status','a.address','a.city','a.zip',"COALESCE(p.website,'')","COALESCE(p.practice_areas,'')","COALESCE(p.photo_key,'')","COALESCE(p.updated_at,'')"].join(',')},'${adapterVersion}')`;
const clock=()=>new Date().toISOString();
export async function hash(value) {const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');}
export async function startScan(db, actor, night=null) {
  const id=crypto.randomUUID();
  // The partial unique index also serializes concurrent manual/nightly requests.
  const result=await db.prepare("INSERT OR IGNORE INTO enrichment_scans(id,night_key,created_at,requested_by) VALUES(?,?,?,?)").bind(id,night,clock(),actor).run();
  if(!result.meta.changes)return (await db.prepare("SELECT id FROM enrichment_scans WHERE status IN ('queued','running') OR night_key=? ORDER BY created_at DESC LIMIT 1").bind(night).first())?.id;
  return id;
}
export async function stageProposal(db, item) {
  const id=await hash(JSON.stringify([item.entity,item.entityId,item.field,item.original,item.proposed,item.baseIdentity,item.evidence.contentHash]));
  const eid=crypto.randomUUID();
  return db.batch([
    db.prepare('INSERT INTO enrichment_evidence(id,source_url,retrieved_at,content_hash,identity,excerpt,verified,rights) VALUES(?,?,?,?,?,?,?,?)').bind(eid,item.evidence.url,item.evidence.retrievedAt,item.evidence.contentHash,item.baseIdentity,item.evidence.excerpt,item.evidence.verified?1:0,item.evidence.rights||''),
    db.prepare(`INSERT OR IGNORE INTO enrichment_proposals(id,scan_id,entity,entity_id,name,state,kind,field,original,proposed,base_identity,evidence_id,explanation,status,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,item.scanId||null,item.entity,item.entityId,item.name,item.state,item.kind,item.field,item.original,item.proposed,item.baseIdentity,eid,item.explanation,item.conflict?'conflict':'pending',clock())
  ]);
}
export async function advanceScan(db, options={}) {
  db=researchDb(db);
  const now=Date.now(),token=crypto.randomUUID();
  const scan=await db.prepare("UPDATE enrichment_scans SET lease_token=?,lease_until=?,status='running' WHERE id=(SELECT id FROM enrichment_scans WHERE status IN ('queued','running') ORDER BY created_at LIMIT 1) AND lease_until<? RETURNING *").bind(token,now+90000,now).first();
  if(!scan)return {busy:true};
  const lease=async()=>{const r=await db.prepare('UPDATE enrichment_scans SET lease_until=? WHERE id=? AND lease_token=? AND lease_until>?').bind(Date.now()+90000,scan.id,token,Date.now()).run();if(!r.meta.changes)throw Error('Scan lease expired');};
  try {
    const count=await db.prepare('SELECT count(*) n FROM enrichment_jobs WHERE scan_id=?').bind(scan.id).first();
    if(!count.n) {
      // Indexed FL selection; only the registered adapter is enabled in v1. Incomplete,
      // unclaimed profiles first. Snapshot receipts avoid re-fetching unchanged data.
      const candidates=await db.prepare(`SELECT a.bar_number,${snapshotSQL} fingerprint FROM attorneys a LEFT JOIN attorney_profiles p USING(bar_number)
        LEFT JOIN enrichment_receipts r ON r.bar_number=a.bar_number
        WHERE a.state='FL' AND COALESCE(p.owner_id,'')='' AND COALESCE(p.claimed_at,'')=''
        AND NOT EXISTS(SELECT 1 FROM profile_claims c WHERE c.bar_number=a.bar_number AND c.status='approved')
        AND (a.admit_date='' OR a.law_school='' OR a.county='' OR a.company='' OR COALESCE(p.website,'')='' OR COALESCE(p.photo_key,'')='')
        AND (r.bar_number IS NULL OR r.fingerprint<>${snapshotSQL} OR r.checked_at<?)
        ORDER BY (a.admit_date='' OR a.law_school='' OR a.county='') DESC,COALESCE(r.checked_at,0),a.bar_number LIMIT 25`).bind(now-30*86400000).all();
      if(candidates.results.length)await db.batch(candidates.results.map(a=>db.prepare('INSERT OR IGNORE INTO enrichment_jobs(id,scan_id,bar_number,fingerprint) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM enrichment_scans WHERE id=? AND lease_token=? AND lease_until>?)').bind(scan.id+':'+a.bar_number,scan.id,a.bar_number,a.fingerprint,scan.id,token,Date.now())));
    }
    const job=await db.prepare("SELECT * FROM enrichment_jobs WHERE scan_id=? AND status IN ('queued','retry') AND next_attempt<=? ORDER BY id LIMIT 1").bind(scan.id,now).first();
    if(!job) {
      const remaining=await db.prepare("SELECT count(*) n FROM enrichment_jobs WHERE scan_id=? AND status IN ('queued','retry')").bind(scan.id).first();
      if(!remaining.n)await db.prepare("UPDATE enrichment_scans SET status='completed',finished_at=? WHERE id=? AND lease_token=?").bind(clock(),scan.id,token).run();
      return {scanId:scan.id,waiting:!!remaining.n};
    }
    const attorney=await db.prepare(`SELECT a.*,COALESCE(p.website,'') website,COALESCE(p.practice_areas,'') practice_areas,COALESCE(p.photo_key,'') photo_key,${identitySQL} base_identity,${snapshotSQL} fingerprint FROM attorneys a LEFT JOIN attorney_profiles p USING(bar_number) WHERE a.bar_number=?`).bind(job.bar_number).first();
    if(!attorney || attorney.fingerprint!==job.fingerprint) {
      await db.prepare("UPDATE enrichment_jobs SET status='changed',error='Record changed after scan selection' WHERE id=?").bind(job.id).run();return {changed:true};
    }
    let missing=0;
    try {
      const adapter=options.research || adapters[attorney.state];if(!adapter)throw Error('State adapter not enabled');
      const source=await adapter(attorney);
      await lease();
      const common={scanId:scan.id,entity:'attorney',entityId:attorney.bar_number,name:attorney.name,state:attorney.state,baseIdentity:attorney.base_identity};
      for(const field of Object.keys(fields)) {
        if(!attorney[field])missing++;
        const found=source.values[field];if(!found || found.value===attorney[field])continue;
        const conflict=!!attorney[field];
        await stageProposal(db,{...common,kind:'text',field,original:attorney[field]||'',proposed:found.value,conflict,explanation:conflict?'Official source differs from the current record. Resolve the conflict individually.':'Missing field found in the identity-matched official bar record. Bar-listed affiliations and practice areas are self-reported, not an independent firm endorsement.',evidence:{url:source.url,retrievedAt:source.retrievedAt,contentHash:source.hash,excerpt:found.excerpt,verified:true}});
      }
      if(options.inspectImage)await options.inspectImage({...common,attorney,source});
      await db.batch([
        db.prepare("UPDATE enrichment_jobs SET status='done',attempts=attempts+1,error='' WHERE id=?").bind(job.id),
        db.prepare('INSERT INTO enrichment_receipts(bar_number,fingerprint,checked_at) VALUES(?,?,?) ON CONFLICT(bar_number) DO UPDATE SET fingerprint=excluded.fingerprint,checked_at=excluded.checked_at').bind(attorney.bar_number,job.fingerprint,Date.now()),
        db.prepare('UPDATE enrichment_scans SET scanned=scanned+1,missing=missing+? WHERE id=? AND lease_token=?').bind(missing,scan.id,token)
      ]);
    } catch(error) {
      await lease();const attempts=job.attempts+1;
      await db.batch([
        db.prepare('UPDATE enrichment_jobs SET status=?,attempts=?,next_attempt=?,error=? WHERE id=?').bind(attempts>=3?'failed':'retry',attempts,Date.now()+Math.min(3600000,60000*2**attempts),String(error.message||'Research failed').slice(0,300),job.id),
        db.prepare('UPDATE enrichment_scans SET errors=errors+1 WHERE id=? AND lease_token=?').bind(scan.id,token)
      ]);
    }
    return {scanId:scan.id};
  } finally {await db.prepare('UPDATE enrichment_scans SET lease_until=? WHERE id=? AND lease_token=?').bind(Date.now()+60000,scan.id,token).run();}
}
export async function scheduledTick(db, enabled, options={}) {
  if(!enabled)return;
  db=researchDb(db);
  const key=nightlyKey();if(key)await startScan(db,'scheduler',key);
  return advanceScan(db,options);
}
export async function decide(db, ids, action, actor, note='') {
  if(!actor || !['approved','rejected','deferred','rolled_back'].includes(action) || !Array.isArray(ids) || ids.length<1 || ids.length>25 || new Set(ids).size!==ids.length)throw Error('Invalid owner decision');
  // Bulk means explicitly selected, individually verified, missing text fields only.
  // Each trigger validates evidence, identity, ownership, freshness and current value.
  if(ids.length>1) {
    const selected=await db.prepare(`SELECT p.* FROM enrichment_proposals p JOIN enrichment_evidence e ON e.id=p.evidence_id WHERE p.id IN (${ids.map(()=>'?').join(',')}) AND p.kind='text' AND p.original='' AND p.status='pending' AND e.verified=1`).bind(...ids).all();
    if(action!=='approved' || selected.results.length!==ids.length)throw Error('Bulk approval requires individually verified missing text fields');
  }
  const result=await db.batch(ids.map(id=>db.prepare('UPDATE enrichment_proposals SET status=?,actor=?,decided_at=?,note=? WHERE id=?').bind(action,actor,clock(),note.slice(0,1000),id)));
  if(result.some(r=>!r.meta.changes))throw Error('Proposal no longer pending; reload');
  return {updated:ids.length};
}
export async function dashboard(db, filters={}) {
  const allowed={entity:['attorney','firm'],kind:['text','photo','banner'],state:['FL','GA'],status:['pending','conflict','deferred','approved','rejected','rolled_back']};
  const clauses=[],args=[];
  for(const [key,values] of Object.entries(allowed))if(values.includes(filters[key])){clauses.push(`p.${key}=?`);args.push(filters[key]);}
  const rows=await db.prepare(`SELECT p.*,e.source_url,e.retrieved_at,e.excerpt,e.verified,e.rights FROM enrichment_proposals p JOIN enrichment_evidence e ON e.id=p.evidence_id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY p.created_at DESC,p.id LIMIT 100`).bind(...args).all();
  const stats=await db.prepare(`SELECT (SELECT COALESCE(sum(scanned),0) FROM enrichment_scans) scanned,(SELECT COALESCE(sum(missing),0) FROM enrichment_scans) missing,
    count(CASE WHEN kind='text' THEN 1 END) verified,count(CASE WHEN kind='photo' THEN 1 END) photos,count(CASE WHEN kind='banner' THEN 1 END) banners,
    count(CASE WHEN status IN ('pending','conflict','deferred') THEN 1 END) pending,count(CASE WHEN status='approved' THEN 1 END) approved,count(CASE WHEN status='rejected' THEN 1 END) rejected FROM enrichment_proposals`).first();
  const scans=await db.prepare('SELECT * FROM enrichment_scans ORDER BY created_at DESC LIMIT 10').all();
  const errors=await db.prepare("SELECT j.bar_number,j.error,j.attempts,j.status FROM enrichment_jobs j JOIN enrichment_scans s ON s.id=j.scan_id WHERE j.error<>'' ORDER BY s.created_at DESC LIMIT 25").all();
  return {rows:rows.results,stats,scans:scans.results,errors:errors.results,nextScan:nextScan()};
}
