import {normalizeLanguages} from '../../languages';
import {notifyFirmClaim} from '../../../db/firm-claim-notification';
import {clientIdentity} from '../../../db/client-auth';
import {rawDb} from '../../../db/raw';
import {accountFirm} from '../../../db/account-firm';
import {firmAccess,firmAccessGuard,firmRecord,ownedFirms} from '../../../db/firm-access';
import {firmKey,firmColumn} from '../attorneys/firm';
import {validateFirmEmail} from '../../../db/claim-verification';
import {sendFirmClaimConfirmation} from '../../../db/firm-claim-email';
import {allowDirectoryAttempt} from '../../../db/directory-protection';
import {firmContactFields,firmSettingsFields,firmText,firmWebsite} from '../../firm-management-fields';
import {linkedInUrl} from '../../linkedin-url';
import {resolveAttorneyReference} from '../../../db/attorney-reference';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const client=await clientIdentity(request);if(!client)return json({error:'Log in to your LawVetter account first.'},401);
 const db=rawDb(),url=new URL(request.url),firms=await ownedFirms(client.user),candidate=await accountFirm(client.user),key=firmKey((url.searchParams.get('firm')||firms[0]?.key||candidate?.key||'').slice(0,200)),firm=key?await firmRecord(key):null;
 const claims=await db.prepare('SELECT id,'+firmColumn('firm_key')+' AS firm_key,firm_name,firm_email,authority,status,firm_email_verified_at,review_note,submitted_at FROM firm_claims WHERE user_id=? ORDER BY submitted_at DESC').bind(client.user).all();
 const canManage=!!firm&&await firmAccess(client.user,key);if(!canManage)return json({firms,firm,claims:claims.results,canManage:false});
 const details=await db.prepare('SELECT name,key,practice_areas,website,linkedin_url,address,city,state,zip,phone,email,biography,additional_locations,updated_at FROM firm_settings WHERE key=?').bind(key).first();
 const barParam=url.searchParams.get('bar');if(barParam){const bar=await resolveAttorneyReference(barParam),attorney=await db.prepare('SELECT a.bar_number,a.name,a.state,a.address,a.city,a.zip,a.phone,a.email,a.county,p.languages,p.bio,p.headline,p.practice_areas,p.website,p.linkedin_url,p.photo_key FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE a.bar_number=? AND '+firmColumn('a.company')+'=?').bind(bar,key).first();if(!attorney)return json({error:'This attorney is not attached to your approved firm.'},403);return json({attorney,canManage:true,firm});}
 return json({firms,firm,claims:claims.results,canManage:true,details:details||{name:firm!.name,key}});
 }catch{return json({error:'Unable to load firm access.'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);const client=await clientIdentity(request);if(!client)return json({error:'Log in first.'},401);const text=await request.text();if(text.length>40000)return json({error:'Request too large.'},413);const data=JSON.parse(text);if(!data||typeof data!=='object')return json({error:'Invalid request.'},400);
 const db=rawDb(),key=firmKey(typeof data.firm==='string'?data.firm.slice(0,200):''),now=new Date().toISOString();
 if(data.action==='resend'){
  if(typeof data.id!=='string'||!await db.prepare("SELECT id FROM firm_claims WHERE id=? AND user_id=? AND status='pending'").bind(data.id,client.user).first())return json({error:'Pending firm claim not found.'},404);return json({emailStatus:await sendFirmClaimConfirmation(data.id)});
 }
 const firm=key?await firmRecord(key):null;if(!firm)return json({error:'Choose an existing law firm.'},404);
 if(data.action==='request'){
  if(!await allowDirectoryAttempt(request,'firm-claim',10))return json({error:'Too many requests. Please try later.'},429);
  const email=validateFirmEmail(data.firmEmail),authority=firmText(data,'authority',2500);if(authority.length<20||data.attestation!==true)return json({error:'Describe your role and authority, and confirm you are authorized to manage this firm.'},400);
  if(await firmAccess(client.user,key))return json({error:'You already manage this firm.'},409);
  const previous=await db.prepare('SELECT id,status,firm_email FROM firm_claims WHERE user_id=? AND firm_key=?').bind(client.user,key).first<{id:string;status:string;firm_email:string}>();
  if(previous?.status==='pending')return json({error:'Your request is already pending. Use Resend verification email if needed.'},409);
  const id=previous?.id||crypto.randomUUID();await db.prepare("INSERT INTO firm_claims(id,firm_key,firm_name,user_id,firm_email,authority,status,submitted_at) VALUES(?,?,?,?,?,?,'pending',?) ON CONFLICT(user_id,firm_key) DO UPDATE SET firm_name=excluded.firm_name,firm_email=excluded.firm_email,authority=excluded.authority,status='pending',firm_email_verified_at=NULL,email_token_hash='',email_token_expires=0,email_sent_at=0,review_note='',submitted_at=excluded.submitted_at,reviewed_at=NULL,reviewed_by=NULL WHERE firm_claims.status IN ('rejected','revoked')").bind(id,key,firm.name,client.user,email,authority,now).run();const [emailStatus,adminEmailStatus]=await Promise.all([sendFirmClaimConfirmation(id),notifyFirmClaim(id)]);return json({saved:true,emailStatus,adminEmailStatus},201);
 }
 if(!await firmAccess(client.user,key))return json({error:'Confirm your firm email to activate eligible access, or wait for administrator review.'},403);
 if(data.action==='save-firm'){
  const fields=firmSettingsFields(data.record||{}),result=await db.batch([
   db.prepare('INSERT INTO firm_settings(key,name,website,linkedin_url,address,city,state,zip,phone,email,biography,additional_locations,updated_at,practice_areas) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,\'\') WHERE '+firmAccessGuard+' ON CONFLICT(key) DO UPDATE SET name=COALESCE(NULLIF(firm_settings.name,\'\'),excluded.name),website=excluded.website,linkedin_url=excluded.linkedin_url,address=excluded.address,city=excluded.city,state=excluded.state,zip=excluded.zip,phone=excluded.phone,email=excluded.email,biography=excluded.biography,additional_locations=excluded.additional_locations,updated_at=excluded.updated_at,practice_areas=COALESCE(?,firm_settings.practice_areas)').bind(key,firm.name,fields.website,fields.linkedin,fields.address,fields.city,fields.state,fields.zip,fields.phone,fields.email,fields.biography,fields.locations,now,fields.practiceAreas??null,key,client.user,fields.practiceAreas??null),
   db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'firm-owner-update',?,? WHERE changes()>0").bind(crypto.randomUUID(),client.user,key,now)
  ]);return result[0].meta.changes?json({saved:true}):json({error:'Firm access changed. Reload your dashboard.'},403);
 }
 const bar=typeof data.bar==='string'?await resolveAttorneyReference(data.bar):'',attorney=await db.prepare('SELECT bar_number,state FROM attorneys WHERE bar_number=? AND '+firmColumn()+'=?').bind(bar,key).first<{bar_number:string;state:string}>();if(!attorney)return json({error:'This attorney is not attached to your approved firm.'},403);
 if(data.action==='detach'){
  if(data.confirm!==true)return json({error:'Confirm removing the attorney from this firm.'},400);
  const result=await db.batch([db.prepare("UPDATE attorneys SET company='',owner_edited=1 WHERE bar_number=? AND "+firmColumn()+'=? AND '+firmAccessGuard).bind(bar,key,key,client.user),db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'firm-owner-detach',?,? WHERE changes()>0").bind(crypto.randomUUID(),client.user,bar,now)]);return result[0].meta.changes?json({saved:true}):json({error:'Firm access or attorney affiliation changed.'},403);
 }
 if(data.action==='save-attorney'){
  const record=data.record||{},languages=record.languages===undefined?undefined:normalizeLanguages(record.languages),fields=firmContactFields({...record,state:attorney.state});if(!fields.city)throw Error('Enter the attorney’s city.');const bio=firmText(record,'bio',5000),headline=firmText(record,'headline',160),practice=firmText(record,'practice_areas',500),website=firmWebsite(firmText(record,'website',2000)),linkedin=linkedInUrl(record.linkedin_url,'attorney')??'',county=firmText(record,'county',120);
  const result=await db.batch([
   db.prepare('UPDATE attorneys SET address=?,city=?,zip=?,phone=?,email=?,county=?,owner_edited=1 WHERE bar_number=? AND '+firmColumn()+'=? AND '+firmAccessGuard).bind(fields.address,fields.city,fields.zip,fields.phone,fields.email,county,bar,key,key,client.user),
   db.prepare("INSERT INTO attorney_profiles(bar_number,languages,owner_id,claimed_at,updated_at,bio,headline,practice_areas,website,linkedin_url) SELECT bar_number,COALESCE(?,''),'','',?,?,?,?,?,? FROM attorneys WHERE bar_number=? AND "+firmColumn()+'=? AND '+firmAccessGuard+' ON CONFLICT(bar_number) DO UPDATE SET languages=COALESCE(?,attorney_profiles.languages),bio=excluded.bio,headline=excluded.headline,practice_areas=excluded.practice_areas,website=excluded.website,linkedin_url=excluded.linkedin_url,updated_at=excluded.updated_at').bind(languages??null,now,bio,headline,practice,website,linkedin,bar,key,key,client.user,languages??null),
   db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,?,'firm-owner-attorney-update',?,? WHERE changes()>0").bind(crypto.randomUUID(),client.user,bar,now)
  ]);return result[0].meta.changes?json({saved:true}):json({error:'Firm access or attorney affiliation changed.'},403);
 }
 return json({error:'Unknown firm action.'},400);
 }catch(error){return json({error:error instanceof Error?error.message:'Unable to save firm changes.'},400);}}
