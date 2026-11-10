import {verifiedEmployer} from '../../../../db/verified-employers';
import {firmPracticeAreas} from '../../../firm-management-fields';
import {validateFirmLocations} from '../../../firm-locations';
import {ensurePublicProfileIds} from '../../../../db/public-profile-ids';
import {clientPhone} from '../../../client-phone';
import {submittedFirmSettings} from '../../../../db/submitted-firm';
import {linkedFirmContact} from '../../../../db/firm-contact';
import {licensedAttorney} from '../../../../db/attorney-identity';
import {linkedInUrl} from '../../../linkedin-url';
import {attorneyLinkedIn,linkedInByFirm} from '../../../firm-websites';
import {deleteDirectoryRecord,assertFirmAllowed,firmDeletionKey} from '../../../../db/directory-deletions';
import {attorneyNameSearch,textWordSearch} from '../../attorneys/search';
import {stateSearch} from '../../../us-states';
import {practiceAreas,practiceSources} from '../../../practice-areas';
import {adminIdentity} from '../../../../db/admin-auth';
import {rawDb} from '../../../../db/raw';
import {saveAttorney,validateAttorney} from '../../../../db/admin-records';
import {firmColumn,firmKey} from '../../attorneys/firm';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 try{
  if(!await adminIdentity(request))return json({error:'Sign in as administrator.'},401);
  const u=new URL(request.url),kind=u.searchParams.get('kind')||'attorneys',q=(u.searchParams.get('q')||'').trim().slice(0,150),city=(u.searchParams.get('city')||'').trim().slice(0,100),requestedState=(u.searchParams.get('state')||'').trim(),state=stateSearch(requestedState),page=Math.floor(Math.max(0,Math.min(100000,Number(u.searchParams.get('page'))||0))),db=rawDb();
  if(requestedState&&!state)return json({error:'Choose a valid state.'},400);
  if(kind==='firm-locations'){
   const name=(u.searchParams.get('firm')||'').trim();
   if(!name||name.length>200)return json({error:'Enter a firm name.'},400);
   const row=await db.prepare('SELECT additional_locations FROM firm_settings WHERE key=?').bind(firmKey(name)).first<{additional_locations:string}>();
   return json({additional_locations:row?.additional_locations||'[]'});
  }
  const escape=(value:string)=>value.replace(/[\\%_]/g,'\\$&'),pattern='%'+escape(q)+'%',locationClauses:string[]=[],locationArgs:string[]=[];
  if(state){locationClauses.push('upper(trim(a.state)) = ?');locationArgs.push(state);}
  if(city){locationClauses.push("lower(trim(a.city)) LIKE ? ESCAPE '\\'");locationArgs.push('%'+escape(city.toLowerCase())+'%');}
  const location=locationClauses.length?' AND '+locationClauses.join(' AND '):'';
  const recent=u.searchParams.get('sort')==='recent';
  let rows,total;
  if(kind==='attorneys'){
   const requestedFirm=u.searchParams.get('firmKey');
   if(requestedFirm!==null){locationClauses.push(firmColumn('a.company')+' = ?');locationArgs.push(firmKey(requestedFirm));}
   const firmLocation=locationClauses.length?' AND '+locationClauses.join(' AND '):'';
   const names=attorneyNameSearch(q.toLowerCase(),'a.','prefix');
   const where=(q?"((a.name LIKE ? ESCAPE '\\' OR a.company LIKE ? ESCAPE '\\' OR COALESCE(a.license_number,a.bar_number) LIKE ? ESCAPE '\\' OR a.email LIKE ? ESCAPE '\\') OR "+names.where+")":"1")+firmLocation,args=[...(q?[pattern,pattern,pattern,pattern,...names.args]:[]),...locationArgs];
   // SQLite rowid preserves insertion order across edits and import upserts.
   const order=recent?'a.rowid DESC':'a.name COLLATE NOCASE,a.bar_number';
   rows=await db.prepare('WITH page AS MATERIALIZED (SELECT a.rowid AS _sort_rowid,a.* FROM attorneys a WHERE '+where+' ORDER BY '+order+' LIMIT 50 OFFSET ?) SELECT a.*,p.languages,p.practice_areas,p.website,p.linkedin_url,p.photo_key,p.headline,p.bio,f.website AS firm_website FROM page a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number LEFT JOIN firm_settings f ON f.key='+firmColumn('a.company')+' ORDER BY '+(recent?'a._sort_rowid DESC':order)).bind(...args,page*50).all();
   // A short nonempty page (or the first empty page) already gives the exact total.
   total=rows.results.length<50&&(page===0||rows.results.length>0)?{count:page*50+rows.results.length}:await db.prepare('SELECT COUNT(*) AS count FROM attorneys a WHERE '+where).bind(...args).first();
  }else if(kind==='clients'){
   const names=textWordSearch(q,'legal_name'),where="(legal_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR "+names.where+")",args=[pattern,pattern,...names.args];
   rows=await db.prepare('SELECT *,EXISTS(SELECT 1 FROM attorney_profiles ap WHERE ap.owner_id=client_profiles.user_id AND ap.claimed_at<>\'\') AS has_attorney_access,EXISTS(SELECT 1 FROM firm_owners fo JOIN firm_claims fc ON fc.id=fo.claim_id WHERE fo.user_id=client_profiles.user_id AND fc.status=\'approved\' AND fc.firm_email_verified_at IS NOT NULL) AS has_firm_access FROM client_profiles WHERE '+where+' ORDER BY legal_name LIMIT 50 OFFSET ?').bind(...args,page*50).all();
   total=await db.prepare('SELECT COUNT(*) AS count FROM client_profiles WHERE '+where).bind(...args).first();
  }else if(kind==='firms'){
   const col=firmColumn('a.company');
   // Keep the directory inline so grouping and affiliation lookups use the firm index.
   const prefix=`WITH directory AS NOT MATERIALIZED (SELECT a.*,${col} AS firm_key FROM attorneys a WHERE a.company<>''),added AS MATERIALIZED (SELECT record_id,action,MIN(created_at) AS created_at FROM admin_audit WHERE action IN ('firm-create','attorney-create') GROUP BY record_id,action) `;
   const union=`SELECT a.firm_key AS key,MIN(a.company) AS name,COUNT(*) AS attorneys,COALESCE(f.website,'') AS website,f.linkedin_url,COALESCE(f.address,'') AS address,COALESCE(f.phone,'') AS phone,COALESCE(f.email,'') AS email,COALESCE(f.city,'') AS city,COALESCE(f.state,'') AS state,COALESCE(f.zip,'') AS zip,COALESCE(f.additional_locations,'[]') AS additional_locations,COALESCE(f.practice_areas,'') AS practiceAreas,${recent?"COALESCE(fa.created_at,MIN(COALESCE(aa.created_at,a.imported_at,'')))":"''"} AS added_at,MIN(CASE WHEN trim(a.address)<>'' THEN json_object('address',a.address,'city',a.city,'state',a.state,'zip',a.zip) END) AS office FROM directory a LEFT JOIN firm_settings f ON f.key=a.firm_key ${recent?"LEFT JOIN added fa ON fa.record_id=a.firm_key AND fa.action='firm-create' LEFT JOIN added aa ON aa.record_id=a.bar_number AND aa.action='attorney-create'":''} WHERE 1${location} GROUP BY a.firm_key UNION ALL SELECT f.key,f.name,0,f.website,f.linkedin_url,f.address,f.phone,f.email,f.city,f.state,f.zip,f.additional_locations,f.practice_areas,${recent?"COALESCE(fa.created_at,f.updated_at,'')":"''"} AS added_at,NULL AS office FROM firm_settings f ${recent?"LEFT JOIN added fa ON fa.record_id=f.key AND fa.action='firm-create'":''} WHERE f.organization_type='Law Firm' AND f.name<>'' AND NOT EXISTS(SELECT 1 FROM directory a WHERE a.firm_key=+f.key)${state?' AND upper(f.state)=?':''}${city?" AND instr(lower(f.city),lower(?))>0":''}`;
   const names=textWordSearch(q,'name'),searchWhere="(name LIKE ? ESCAPE '\\' OR "+names.where+")";
   const args=[...locationArgs,...(state?[state]:[]),...(city?[city]:[])];
   rows=await db.prepare(prefix+'SELECT * FROM ('+union+') WHERE '+searchWhere+' ORDER BY '+(recent?'added_at DESC,name COLLATE NOCASE':'name COLLATE NOCASE')+" LIMIT 50 OFFSET ?").bind(...args,pattern,...names.args,page*50).all();
   total=await db.prepare(prefix+'SELECT COUNT(*) AS count FROM ('+union+') WHERE '+searchWhere).bind(...args,pattern,...names.args).first();
   rows.results=await Promise.all(rows.results.map(async row=>{
    const key=String(row.key),saved=row as {website?:string;phone?:string};
    // Match the public firm's saved, published-submission, and linked-attorney sources.
    const submitted=saved.website?.trim()?null:await submittedFirmSettings(key);
    return {...row,...await linkedFirmContact(key,{website:saved.website?.trim()||submitted?.website||'',phone:saved.phone})};
   }));
  }else return json({error:'Unknown record type.'},400);
  if(kind==='attorneys')await ensurePublicProfileIds(rows.results);
  return json({records:kind==='attorneys'?rows.results.map(r=>({...r,linkedin_url:(r as {linkedin_url?:string|null}).linkedin_url??attorneyLinkedIn[(r as {bar_number:string}).bar_number]??'',practice_areas:(r as {practice_areas?:string|null}).practice_areas??practiceSources[(r as {bar_number:string}).bar_number]?.areas.map(id=>practiceAreas.find(a=>a.id===id)?.name).filter(Boolean).join(', ')??''})):kind==='firms'?rows.results.map(r=>({...r,...(!(r as {address?:string}).address&&typeof r.office==='string'?JSON.parse(r.office):{}),linkedinUrl:(r as {linkedin_url?:string|null}).linkedin_url??linkedInByFirm[(r as {key:string}).key]??''})):rows.results,total:(total as {count:number})?.count||0,page});
 }catch(error){console.error('Admin records read failed',error instanceof Error?error.message:String(error));return json({error:'Unable to load records.'},503);}
}
export async function POST(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);try{const identity=await adminIdentity(request);if(!identity)return json({error:'Sign in as administrator.'},401);const raw=await request.text();if(raw.length>30000)return json({error:'Record too large.'},413);const d=JSON.parse(raw),db=rawDb(),now=new Date().toISOString();if(d.kind==='attorneys'){const record=validateAttorney({...d.record,recordId:d.record?._new?undefined:d.record?._id},true);if(d.record?.firmAdditionalLocations!==undefined){if(!record.company)throw Error('Enter the firm name before adding another address.');record.firmAdditionalLocations=JSON.stringify(validateFirmLocations(d.record.firmAdditionalLocations));}if(record.firmWebsite&&!record.company)throw Error('Enter the law firm name before adding its website.');if(record.firmWebsite==='')delete record.firmWebsite;if(d.record?._new&&await licensedAttorney(record.state!,record.barNumber!,record.sourceUrl))return json({error:'This attorney is already listed. Edit the existing record.'},409);const saved=await saveAttorney(record,identity.email,false,!!d.record?._new,true,true);if(d.record?._new&&saved.skipped)return json({error:'This attorney was just added. Edit the existing record.'},409);return json({saved:true,id:saved.id});}
if(d.kind==='firms'){
 const r=d.record,linkedin=linkedInUrl(r?.linkedinUrl,'firm');
 if(typeof r?.name!=='string'||r.name.trim().length<2||r.name.length>200)return json({error:'Enter a firm name.'},400);
 const value=(field:string,max:number)=>{const v=r[field]??'';if(typeof v!=='string'||v.length>max||/[<>]/.test(v))throw Error('Invalid '+field+'.');return v.trim();};
 if(verifiedEmployer(r.name))return json({error:'This organization is not a law firm. Enter it as an attorney employer.'},400);
 const name=r.name.trim(),website=value('website',2000),address=value('address',500),phone=value('phone',80),email=value('email',254),city=value('city',120),state=value('state',2).toUpperCase(),zip=value('zip',10);
 if(zip&&!/^\d{5}(-\d{4})?$/.test(zip))return json({error:'Enter a 5-digit ZIP code or ZIP+4.'},400);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid firm email.'},400);
 if(state&&!stateSearch(state))return json({error:'Choose a valid state.'},400);
 if(website){const url=new URL(website);if(url.protocol!=='https:'||url.username||url.password)return json({error:'Use an HTTPS website.'},400);}
 await assertFirmAllowed(name);const key=firmKey(name),oldKey=r._new?key:String(r.key||'');
 const exists=await db.prepare('SELECT key FROM firm_settings WHERE key=? UNION SELECT '+firmColumn()+' AS key FROM attorneys WHERE '+firmColumn()+'=? LIMIT 1').bind(key,key).first();
 if((r._new||oldKey!==key)&&exists)return json({error:'This firm is already listed. Edit the existing firm.'},409);
 if(!r._new&&!await db.prepare('SELECT key FROM firm_settings WHERE key=? UNION SELECT '+firmColumn()+' AS key FROM attorneys WHERE '+firmColumn()+'=? LIMIT 1').bind(oldKey,oldKey).first())return json({error:'Firm not found.'},404);
 const extra=r.additional_locations===undefined?undefined:JSON.stringify(validateFirmLocations(r.additional_locations));
 const old=await db.prepare('SELECT banner_key,additional_locations,biography,practice_areas FROM firm_settings WHERE key=?').bind(oldKey).first<{banner_key:string;additional_locations:string;biography:string|null;practice_areas:string}>();
 const statements=[db.prepare('INSERT INTO firm_settings(key,name,website,linkedin_url,address,phone,email,city,state,zip,banner_key,updated_at,additional_locations,biography,practice_areas) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,\'[]\'),?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name,website=excluded.website,linkedin_url=COALESCE(excluded.linkedin_url,firm_settings.linkedin_url),address=excluded.address,phone=excluded.phone,email=excluded.email,city=excluded.city,state=excluded.state,zip=excluded.zip,updated_at=excluded.updated_at,additional_locations=COALESCE(?,firm_settings.additional_locations),practice_areas=excluded.practice_areas').bind(key,name,website,linkedin??null,address,phone,email,city,state,zip,old?.banner_key||'',now,extra??old?.additional_locations??null,old?.biography??null,r.practiceAreas===undefined?(old?.practice_areas||''):firmPracticeAreas(r.practiceAreas),extra??null)];
 if(!r._new)statements.push(db.prepare('UPDATE attorneys SET company=?,owner_edited=1 WHERE '+firmColumn()+'=?').bind(name,oldKey));
 if(oldKey!==key)statements.push(db.prepare('UPDATE google_firm_arrivals SET firm_key=?,firm_name=? WHERE firm_key=?').bind(key,name,oldKey),db.prepare('UPDATE firm_owners SET firm_key=? WHERE firm_key=?').bind(key,oldKey),db.prepare('UPDATE firm_claims SET firm_key=?,firm_name=? WHERE firm_key=?').bind(key,name,oldKey),db.prepare('UPDATE firm_messages SET firm_key=? WHERE firm_key=?').bind(key,oldKey),db.prepare("UPDATE directory_page_views SET target_key=? WHERE target_key=? AND target_kind='firm'").bind(key,oldKey),db.prepare('UPDATE firm_search_events SET firm_key=?,firm_name=? WHERE firm_key=?').bind(key,name,oldKey),db.prepare('DELETE FROM firm_settings WHERE key=?').bind(oldKey));
 statements.push(db.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),identity.email,r._new?'firm-create':'firm-update',key,now));
 await db.batch(statements);return json({saved:true});
}
if(d.kind==='clients'){const r=d.record;const phone=clientPhone(r?.phone);if(typeof r?.user_id!=='string'||typeof r.legal_name!=='string'||r.legal_name.length<2||r.legal_name.length>200||typeof r.email!=='string'||r.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))return json({error:'Enter a valid client name and email.'},400);const existing=await db.prepare('SELECT email FROM client_profiles WHERE user_id=?').bind(r.user_id).first<{email:string}>();if(!existing)return json({error:'Client not found.'},404);const email=r.email.trim().toLowerCase(),used=await db.prepare('SELECT user_id FROM client_account_emails WHERE email=? AND user_id<>?').bind(email,r.user_id).first();if(used)return json({error:'Email belongs to another account.'},409);await db.batch([db.prepare('UPDATE client_profiles SET legal_name=?,first_name=?,last_name=?,email=?,phone=? WHERE user_id=?').bind(r.legal_name,String(r.first_name||'').slice(0,100),String(r.last_name||'').slice(0,100),email,phone,r.user_id),db.prepare('UPDATE client_account_emails SET email=? WHERE user_id=?').bind(email,r.user_id),db.prepare('DELETE FROM client_sessions WHERE user_id=?').bind(r.user_id),db.prepare('DELETE FROM client_password_reset_tokens WHERE user_id=?').bind(r.user_id),db.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),identity.email,'client-update',r.user_id,now)]);return json({saved:true});}return json({error:'Unknown record type.'},400);}catch(e){return json({error:e instanceof Error?e.message:'Unable to save.'},400);}}

export async function DELETE(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 try{const identity=await adminIdentity(request);if(!identity)return json({error:'Sign in as administrator.'},401);
 const raw=await request.text();if(raw.length>1000)return json({error:'Invalid deletion request.'},413);
 const d=JSON.parse(raw);if(!['attorneys','firms','clients'].includes(d?.kind)||typeof d.id!=='string'||!d.id.trim()||d.id.length>500||d.confirm!==true)return json({error:'Confirm the record you want to delete.'},400);
 if(!await deleteDirectoryRecord(d.kind,d.id,identity.email))return json({error:'This record is no longer listed.'},404);
 return json({deleted:true});
 }catch{return json({error:'Unable to delete the record. Reload and try again.'},503);}
}
