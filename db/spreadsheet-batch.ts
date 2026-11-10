import {rawDb} from './raw';
import type {AttorneyInput} from './admin-records';
import {isActiveMembership} from '../app/membership-status';
import {employmentType} from '../app/employment';
import {verifiedEmployer} from './verified-employers';
import {firmKey} from '../app/api/attorneys/firm';
import {directoryInsertGuard,firmDeletionKey,licenseKey} from './directory-deletions';

type Existing={bar_number:string;license_number:string|null;source_url:string;name:string};
type RowResult={name?:string;bar?:string;ok:boolean;skipped?:boolean;id?:string;error?:string};

// The authenticated spreadsheet endpoint validates fields before calling this
// Florida-only path. Bulk lookups replace per-attorney network round trips.
export async function importFloridaSpreadsheet(records:AttorneyInput[],sources:Record<string,unknown>[],actor:string,preview:boolean){
 const db=rawDb(),licenses=JSON.stringify(records.map(r=>r.barNumber)),ids=JSON.stringify(records.map(r=>'FL:'+r.barNumber)),urls=JSON.stringify(records.map(r=>r.sourceUrl||'').filter(Boolean));
 const deletedLicenses=JSON.stringify(records.map(r=>licenseKey('FL',r.barNumber!))),deletedFirms=JSON.stringify(records.map(r=>firmDeletionKey(r.company||'')));
 const [matches,deleted]=await Promise.all([
  db.prepare("SELECT bar_number,license_number,source_url,name FROM attorneys WHERE state='FL' AND NULLIF(COALESCE(license_number,bar_number),'') IN (SELECT value FROM json_each(?)) UNION SELECT bar_number,license_number,source_url,name FROM attorneys WHERE state='FL' AND bar_number IN (SELECT value FROM json_each(?)) UNION SELECT bar_number,license_number,source_url,name FROM attorneys WHERE state='FL' AND source_url IN (SELECT value FROM json_each(?))").bind(licenses,ids,urls).all<Existing>(),
  db.prepare("SELECT action,record_id FROM admin_audit WHERE (action='attorney-delete' AND record_id IN (SELECT value FROM json_each(?))) OR (action='firm-delete' AND record_id IN (SELECT value FROM json_each(?)))").bind(deletedLicenses,deletedFirms).all<{action:string;record_id:string}>()
 ]);
 const blockedAttorneys=new Set(deleted.results.filter(r=>r.action==='attorney-delete').map(r=>r.record_id)),blockedFirms=new Set(deleted.results.filter(r=>r.action==='firm-delete').map(r=>r.record_id));
 const results:RowResult[]=[],seen=new Set<string>(),pending:{row:AttorneyInput;index:number;id:string;sourceId:string;company:string;type:string;employer:string;employerWebsite:string}[]=[];
 let created=0,skipped=0,withoutPhoto=0;
 for(let i=0;i<records.length;i++){
  const r=records[i],id='FL:'+r.barNumber,result:RowResult={name:r.name,bar:r.barNumber,ok:true};results.push(result);
  try{
   const byLicense=matches.results.find(m=>(m.license_number||m.bar_number)===r.barNumber||(!m.license_number&&m.bar_number===id)),bySource=r.sourceUrl?matches.results.find(m=>m.source_url===r.sourceUrl):undefined;
   if(byLicense&&bySource&&byLicense.bar_number!==bySource.bar_number)throw Error('The bar number and official profile URL belong to different directory records. Review the existing profiles.');
   if(seen.has(id)||byLicense||bySource){result.skipped=true;skipped++;continue;}
   if(!isActiveMembership(r.status))throw Error('Verify active membership before saving.');
   if(blockedAttorneys.has(licenseKey('FL',r.barNumber!)))throw Error('This attorney was deleted by the administrator and cannot be imported again.');
   if(r.company&&blockedFirms.has(firmDeletionKey(r.company)))throw Error('This firm was deleted by the administrator. Remove it from the record or choose another firm.');
   const type=employmentType(r.employmentType||verifiedEmployer(r.company||'')?.type);
   if(type==='Law Firm Attorney'&&verifiedEmployer(r.company||''))throw Error('This organization is not a law firm. Choose In House Counsel or Government Attorney.');
   const company=type==='Law Firm Attorney'?(r.company||''):'',employer=type==='Law Firm Attorney'?'':r.employerName??r.company??'',employerWebsite=type==='Law Firm Attorney'?'':r.employerWebsite??r.firmWebsite??'';
   const photoFilename=sources[i]?.photoFilename;
   seen.add(id);if(!r.photoKey&&!(typeof photoFilename==='string'&&photoFilename.trim()))withoutPhoto++;
   if(preview){created++;result.skipped=false;}else pending.push({row:r,index:i,id,sourceId:'admin:'+crypto.randomUUID(),company,type,employer,employerWebsite});
  }catch(e){result.ok=false;result.error=e instanceof Error?e.message:'Unable to save this row.';}
 }
 if(preview||!pending.length)return {created,skipped,withoutPhoto,updated:0,results};
 const now=new Date().toISOString(),statements:ReturnType<typeof db.prepare>[]=[],insertIndexes:number[]=[];
 for(const p of pending){
  const r=p.row,columns=['name','company','employment_type','employer_name','employer_website','city','county','status','admit_date','law_school','address','zip','phone','email','source_url'];
  const values=[r.name||'',p.company,p.type,p.employer,p.employerWebsite,r.city||'',r.county||'',r.status||'',r.admitDate||'',r.lawSchool||'',r.address||'',r.zip||'',r.phone||'',r.email||'',r.sourceUrl||''];
  insertIndexes.push(statements.length);
  // Both duplicate and deletion guards run inside the atomic write, covering
  // a concurrent import or deletion after the preview. Never update a profile.
  statements.push(db.prepare(`INSERT INTO attorneys(bar_number,license_number,source_id,state,imported_at,owner_edited,public_id,${columns.join(',')}) SELECT ${Array(columns.length+7).fill('?').join(',')} WHERE ${directoryInsertGuard} AND NOT EXISTS(SELECT 1 FROM attorneys WHERE state='FL' AND NULLIF(COALESCE(license_number,bar_number),'')=?) AND NOT EXISTS(SELECT 1 FROM attorneys WHERE state='FL' AND bar_number IN (?,?)) AND (?='' OR NOT EXISTS(SELECT 1 FROM attorneys WHERE state='FL' AND source_url=?)) ON CONFLICT(bar_number) DO NOTHING`).bind(p.id,r.barNumber!,p.sourceId,'FL',now,1,crypto.randomUUID().replaceAll('-',''),...values,licenseKey('FL',r.barNumber!),firmDeletionKey(r.company||''),r.barNumber!,r.barNumber!,p.id,r.sourceUrl||'',r.sourceUrl||''));
  const inserted='EXISTS(SELECT 1 FROM attorneys WHERE bar_number=? AND source_id=?)';
  const profileMap={headline:'headline',bio:'bio',practiceAreas:'practice_areas',website:'website',photoKey:'photo_key',linkedinUrl:'linkedin_url'};
  const profile=Object.entries(profileMap).filter(([k])=>!!r[k as keyof AttorneyInput]);
  if(profile.length)statements.push(db.prepare(`INSERT INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at,${profile.map(([,c])=>c).join(',')}) SELECT ?,'','',?,${profile.map(()=>'?').join(',')} WHERE ${inserted} ON CONFLICT(bar_number) DO NOTHING`).bind(p.id,now,...profile.map(([k])=>r[k as keyof AttorneyInput]!),p.id,p.sourceId));
  // A new attorney never replaces an existing firm's website or claimed data.
  if(p.company&&r.firmWebsite)statements.push(db.prepare(`INSERT INTO firm_settings(key,website,updated_at) SELECT ?,?,? WHERE ${inserted} ON CONFLICT(key) DO NOTHING`).bind(firmKey(p.company),r.firmWebsite,now,p.id,p.sourceId));
  statements.push(db.prepare(`INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'attorney-create',?,? WHERE ${inserted}`).bind(crypto.randomUUID(),actor,p.id,now,p.id,p.sourceId));
 }
 const saved=await db.batch(statements);
 const notInserted=pending.filter((_,i)=>!saved[insertIndexes[i]].meta.changes);
 let concurrent:Existing[]=[];
 if(notInserted.length){const found=await db.prepare("SELECT bar_number,license_number,source_url,name FROM attorneys WHERE state='FL' AND NULLIF(COALESCE(license_number,bar_number),'') IN (SELECT value FROM json_each(?)) UNION SELECT bar_number,license_number,source_url,name FROM attorneys WHERE state='FL' AND bar_number IN (SELECT value FROM json_each(?)) UNION SELECT bar_number,license_number,source_url,name FROM attorneys WHERE state='FL' AND source_url IN (SELECT value FROM json_each(?))").bind(JSON.stringify(notInserted.map(p=>p.row.barNumber)),JSON.stringify(notInserted.map(p=>p.id)),JSON.stringify(notInserted.map(p=>p.row.sourceUrl||'').filter(Boolean))).all<Existing>();concurrent=found.results;}
 for(let i=0;i<pending.length;i++){
  const p=pending[i],result=results[p.index];
  if(saved[insertIndexes[i]].meta.changes){created++;result.id=p.id;result.skipped=false;}
  else if(concurrent.some(m=>(m.license_number||m.bar_number)===p.row.barNumber||m.bar_number===p.id||!!p.row.sourceUrl&&m.source_url===p.row.sourceUrl)){skipped++;result.skipped=true;}
  else{result.ok=false;result.error='This record was deleted or changed during saving. Reload the directory.';}
 }
 return {created,skipped,withoutPhoto,updated:0,results};
}
