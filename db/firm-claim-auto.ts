import {rawDb} from './raw';
import {firmColumn} from '../app/api/attorneys/firm';
// Use existing directory data, never a URL or domain supplied by the claimant.
export async function trustedFirmEmail(key:string,email:string){
 const domain=email.trim().toLowerCase().split('@')[1];
 if(!domain||/^(gmail|yahoo|hotmail|outlook|live|aol|icloud|protonmail|proton|mail)\.(com|me)$/.test(domain))return false;
 const db=rawDb();
 const rows=await db.prepare('SELECT email,website FROM firm_settings WHERE key=? UNION ALL SELECT a.email,COALESCE(p.website,\'\') AS website FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE '+firmColumn('a.company')+'=?').bind(key,key).all<{email:string;website:string}>();
 return rows.results.some(row=>{
  if(row.email?.trim().toLowerCase().split('@')[1]===domain)return true;
  try{const host=new URL(row.website).hostname.toLowerCase().replace(/^www\./,'');return host===domain;}catch{return false;}
 });
}
