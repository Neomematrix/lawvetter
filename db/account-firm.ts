import {ownedFirms,firmRecord} from './firm-access';
import {rawDb} from './raw';
import {firmColumn} from '../app/api/attorneys/firm';
export type AccountFirm={name:string;key:string};
// This identifies a public roster to display; it grants no ownership or editing rights.
export async function accountFirm(user:string):Promise<AccountFirm|null>{
 const owned=await ownedFirms(user);if(owned.length)return owned[0];
 const db=rawDb();
 const requested=await db.prepare('SELECT firm_key FROM firm_claims WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1').bind(user).first<{firm_key:string}>();if(requested){const firm=await firmRecord(requested.firm_key);if(firm)return firm;}

 const saved=await db.prepare('SELECT f.name,f.key FROM client_profiles p JOIN firm_settings f ON f.key='+firmColumn('p.legal_name')+" WHERE p.user_id=? AND trim(f.name)<>'' LIMIT 1").bind(user).first<AccountFirm>();
 if(saved)return saved;
 return db.prepare('SELECT MIN(a.company) AS name,'+firmColumn('a.company')+' AS key FROM client_profiles p JOIN attorneys a ON '+firmColumn('a.company')+'='+firmColumn('p.legal_name')+" WHERE p.user_id=? AND trim(a.company)<>'' GROUP BY "+firmColumn('a.company')+' LIMIT 1').bind(user).first<AccountFirm>();
}
export function firmAccountSQL(profile='p'){
 const key=firmColumn(profile+'.legal_name');
 return '(EXISTS(SELECT 1 FROM firm_claims fc WHERE fc.user_id='+profile+'.user_id) OR EXISTS(SELECT 1 FROM firm_settings f WHERE f.key='+key+" AND trim(f.name)<>'') OR EXISTS(SELECT 1 FROM attorneys fa WHERE "+firmColumn('fa.company')+'='+key+" AND trim(fa.company)<>''))";
}
