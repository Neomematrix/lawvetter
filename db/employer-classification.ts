import {firmColumn,firmKey} from '../app/api/attorneys/firm';
import {verifiedEmployers} from './verified-employers';
// Bounded batches preserve original records in the audit backup. No IDs, reviews,
// claims, search events, awards, analytics, photos, or contact details are deleted.
export async function reclassifyVerifiedEmployers(db:D1Database,companies?:string[]){
 const requested=companies?new Set(companies.map(firmKey)):undefined;
 let changed=0;
 for(const entry of verifiedEmployers)for(const name of entry.names){
  const key=firmKey(name);
  if(requested&&!requested.has(key))continue;
  const now=new Date().toISOString(),backupKey='employer-reclassification:'+key;
  const rows=await db.prepare('SELECT * FROM attorneys WHERE '+firmColumn()+'=?').bind(key).all<Record<string,unknown>>();
  const firm=await db.prepare('SELECT * FROM firm_settings WHERE key=?').bind(key).first<Record<string,unknown>>();
  if(!rows.results.length&&(!firm||firm.organization_type!=='Law Firm'))continue;
  const settings=JSON.stringify({source:entry.source,verifiedAt:now,attorneys:rows.results,firm});
  await db.prepare('INSERT OR IGNORE INTO site_settings(key,value,updated_at) VALUES(?,?,?)').bind(backupKey,settings,now).run();
  const result=await db.batch([
   db.prepare("INSERT INTO firm_settings(key,name,organization_type,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET organization_type=excluded.organization_type,updated_at=excluded.updated_at").bind(key,String(firm?.name||name),entry.type,now),
   db.prepare("UPDATE attorneys SET employment_type=?,employer_name=company,employer_website=COALESCE(NULLIF(employer_website,''),(SELECT website FROM firm_settings WHERE key=?),''),company='' WHERE "+firmColumn()+"=? AND employment_type='Law Firm Attorney'").bind(entry.type,key,key),
   db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,'employer-reclassify',?,?)").bind(crypto.randomUUID(),'owner-authorized:official-organization-verification',key,now)
  ]);changed+=result[1].meta.changes;
 }
 return changed;
}
