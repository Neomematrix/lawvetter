import {rawDb} from './raw';
import {firmColumn} from '../app/api/attorneys/firm';

// A biography or directory profile is not the firm's home page.
export function firmHomepage(value:string){
 try{
  const url=new URL(value),host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return '';
  if(['linkedin.com','facebook.com','instagram.com','x.com','twitter.com','avvo.com','findlaw.com','justia.com','floridabar.org','gabar.org'].some(domain=>host===domain||host.endsWith('.'+domain)))return '';
  return url.toString();
 }catch{return '';}
}

// Keep explicit firm contacts; otherwise use current affiliations, independent of
// the displayed roster page. Older banner-only settings must not suppress these.
export async function linkedFirmContact(key:string,saved:{website?:string;phone?:string}){
 const db=rawDb();let website=saved.website?.trim()||'',phone=saved.phone?.trim()||'';
 if(!phone){
  const row=await db.prepare('SELECT phone FROM attorneys WHERE '+firmColumn()+"=? AND trim(phone)<>'' ORDER BY owner_edited DESC,imported_at DESC,name COLLATE NOCASE,bar_number LIMIT 1").bind(key).first<{phone:string}>();
  phone=row?.phone||'';
 }
 if(!website){
  const rows=await db.prepare('SELECT p.website FROM attorneys a JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE '+firmColumn('a.company')+"=? AND trim(p.website)<>'' ORDER BY a.owner_edited DESC,p.updated_at DESC,a.name COLLATE NOCASE,a.bar_number").bind(key).all<{website:string}>();
  website=rows.results.map(row=>firmHomepage(row.website)).find(Boolean)||'';
 }
 return {website,phone};
}
