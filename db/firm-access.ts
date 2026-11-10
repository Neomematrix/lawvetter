import {rawDb} from './raw';
import {firmColumn,firmKey} from '../app/api/attorneys/firm';
export const firmAccessGuard="EXISTS(SELECT 1 FROM firm_owners fo JOIN firm_claims fc ON fc.id=fo.claim_id JOIN client_profiles cp ON cp.user_id=fo.user_id WHERE fo.firm_key=? AND fo.user_id=? AND fc.status='approved' AND fc.firm_email_verified_at IS NOT NULL)";
export async function firmAccess(user:string,key:string){return !!user&&!!key&&!!await rawDb().prepare('SELECT 1 AS allowed WHERE '+firmAccessGuard).bind(key,user).first();}
export async function firmAttorneyAccess(user:string,bar:string){const row=await rawDb().prepare('SELECT company FROM attorneys WHERE bar_number=?').bind(bar).first<{company:string}>();return row?firmAccess(user,firmKey(row.company)):false;}
export async function firmRecord(key:string){
 key=firmKey(key);
 const db=rawDb();return await db.prepare("SELECT name,key FROM firm_settings WHERE organization_type='Law Firm' AND key=? AND name<>''").bind(key).first<{name:string;key:string}>()||await db.prepare('SELECT MIN(company) AS name,'+firmColumn()+' AS key FROM attorneys WHERE '+firmColumn()+"=? AND company<>'' GROUP BY "+firmColumn()+' LIMIT 1').bind(key).first<{name:string;key:string}>();
}
export async function ownedFirms(user:string){return (await rawDb().prepare("SELECT fo.firm_key AS key,COALESCE(NULLIF(f.name,''),fc.firm_name) AS name FROM firm_owners fo JOIN firm_claims fc ON fc.id=fo.claim_id JOIN client_profiles cp ON cp.user_id=fo.user_id LEFT JOIN firm_settings f ON f.key=fo.firm_key WHERE COALESCE(f.organization_type,'Law Firm')='Law Firm' AND fo.user_id=? AND fc.status='approved' AND fc.firm_email_verified_at IS NOT NULL ORDER BY name").bind(user).all<{key:string;name:string}>()).results;}
