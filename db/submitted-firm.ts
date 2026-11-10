import {rawDb} from './raw';
import {directoryDetails} from './directory-details';
import {firmKey,firmColumn} from '../app/api/attorneys/firm';
import {linkedInUrl} from '../app/linkedin-url';
// Keep the submitted firm links in the same approval transaction as the profile.
export function submittedFirmStatement(name:string,notes:string,id:string,now:string){
 const details=directoryDetails(notes);if(!name||(!details.firmWebsite&&!details.firmLinkedInUrl))return null;
 return rawDb().prepare("INSERT INTO firm_settings(key,website,linkedin_url,updated_at) SELECT ?,?,?,? FROM directory_submissions WHERE id=? AND status IN ('pending','approved_for_import') AND notes=? ON CONFLICT(key) DO UPDATE SET website=COALESCE(NULLIF(excluded.website,''),firm_settings.website),linkedin_url=COALESCE(excluded.linkedin_url,firm_settings.linkedin_url),updated_at=excluded.updated_at").bind(firmKey(name),details.firmWebsite||'',linkedInUrl(details.firmLinkedInUrl,'firm')??null,now,id,notes);
}
function website(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.toString():'';}catch{return '';}}
export async function submittedFirmSettings(key:string){
 if(!key)return {website:null,linkedin_url:null};
 const db=rawDb(),saved=await db.prepare('SELECT website,linkedin_url FROM firm_settings WHERE key=?').bind(key).first<{website:string;linkedin_url:string|null}>();
 let url=saved?.website||'',linkedin=saved?.linkedin_url||null;
 if(!url||!linkedin){const rows=await db.prepare("SELECT kind,website,notes FROM directory_submissions WHERE status='published' AND "+firmColumn("CASE WHEN kind='firm' THEN name ELSE firm_name END")+"=? ORDER BY reviewed_at DESC LIMIT 100").bind(key).all<{kind:string;website:string;notes:string}>();
  for(const item of rows.results){const d=directoryDetails(item.notes);if(!url)url=website(d.firmWebsite||(item.kind==='firm'?item.website:''));if(!linkedin){try{linkedin=linkedInUrl(item.kind==='firm'?d.linkedinUrl:d.firmLinkedInUrl,'firm')||null;}catch{}}if(url&&linkedin)break;}
 }
 return {website:url||null,linkedin_url:linkedin};
}
export async function attorneyFirmSettings(bar:string){const row=await rawDb().prepare('SELECT company FROM attorneys WHERE bar_number=?').bind(bar).first<{company:string}>();return submittedFirmSettings(firmKey(row?.company||''));}

export async function publishedFirmBiography(key:string){
 if(!key)return '';
 const saved=await rawDb().prepare('SELECT biography FROM firm_settings WHERE key=?').bind(key).first<{biography:string|null}>();if(saved?.biography!==null&&saved?.biography!==undefined)return saved.biography;
 const row=await rawDb().prepare("SELECT notes FROM directory_submissions WHERE kind='firm' AND status='published' AND "+firmColumn('name')+"=? ORDER BY reviewed_at DESC,submitted_at DESC LIMIT 1").bind(key).first<{notes:string}>();
 if(!row)return '';
 const details=directoryDetails(row.notes);
 return (details.biography??(details.notes.startsWith('Firm ownership review request.')?'':details.notes)).trim();
}
