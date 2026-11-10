import {verifiedFirmRoster} from '../app/verified-firm-rosters';
import {rawDb} from './raw';
import {firmKey,firmColumn} from '../app/api/attorneys/firm';

export const firmDeletionKey=(name:string)=>firmKey(verifiedFirmRoster(firmKey(name))?.name||name);
// Use inside INSERT statements as well as preflight checks to cover concurrent deletions.
export const directoryInsertGuard="NOT EXISTS (SELECT 1 FROM admin_audit WHERE (action='attorney-delete' AND record_id=?) OR (action='firm-delete' AND record_id=?))";
export const licenseKey=(state:string,license:string)=>state.toUpperCase()+':'+license;
export async function attorneyDeleted(state:string,license:string){return !!await rawDb().prepare("SELECT id FROM admin_audit WHERE action='attorney-delete' AND record_id=? LIMIT 1").bind(licenseKey(state,license)).first();}
export async function firmDeleted(name:string){return !!await rawDb().prepare("SELECT id FROM admin_audit WHERE action='firm-delete' AND record_id=? LIMIT 1").bind(firmDeletionKey(name)).first();}
export async function assertAttorneyAllowed(state:string,license:string){if(license&&await attorneyDeleted(state,license))throw Error('This attorney was deleted by the administrator and cannot be imported again.');}
export async function assertFirmAllowed(name:string){if(name&&await firmDeleted(name))throw Error('This firm was deleted by the administrator. Remove it from the record or choose another firm.');}

export async function deleteDirectoryRecord(kind:string,id:string,actor:string){
 const db=rawDb(),now=new Date().toISOString();
 if(kind==='clients'){
  const client=await db.prepare('SELECT email FROM client_profiles WHERE user_id=?').bind(id).first<{email:string}>();if(!client)return false;
  const statements=['client_verification_audit','client_approval_emails','client_verification_request_emails','client_rejection_emails','review_moderation_emails'].map(table=>db.prepare('DELETE FROM '+table+' WHERE verification_id IN (SELECT id FROM client_verifications WHERE user_id=?)').bind(id));
  statements.push(db.prepare('DELETE FROM referral_notifications WHERE owner_id=?').bind(id),db.prepare('DELETE FROM firm_owners WHERE user_id=?').bind(id),db.prepare('DELETE FROM firm_claims WHERE user_id=?').bind(id));
  for(const table of ['client_verifications','shortlist','profile_claims','client_sessions','client_password_reset_tokens','client_passwords','client_account_emails'])statements.push(db.prepare('DELETE FROM '+table+' WHERE user_id=?').bind(id));
  statements.push(db.prepare("UPDATE attorney_profiles SET owner_id='',claimed_at='',updated_at=? WHERE owner_id=?").bind(now,id),db.prepare("UPDATE directory_submissions SET status='deleted',review_note='Submitting account removed by administrator.',reviewed_at=?,reviewed_by=? WHERE submitter_email=? AND status IN ('pending','approved_for_import')").bind(now,actor,client.email),db.prepare('DELETE FROM client_profiles WHERE user_id=?').bind(id),db.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,'client-delete',id,now));await db.batch(statements);return true;
 }
 if(kind==='firms'){
  const roster=verifiedFirmRoster(firmKey(id)),key=firmKey(roster?.name||id),requestedKey=firmKey(id);if(!key)throw Error('Invalid firm.');
  const where='('+firmColumn()+" IN (?,?) OR (owner_edited=0 AND employment_type='Law Firm Attorney' AND bar_number IN (SELECT value FROM json_each(?))))",args=[key,requestedKey,JSON.stringify(roster?.bars||[])];
  const found=await db.prepare('SELECT bar_number FROM attorneys WHERE '+where+' LIMIT 1').bind(...args).first();if(!found&&!await db.prepare('SELECT key FROM firm_settings WHERE key IN (?,?)').bind(key,requestedKey).first())return false;
  await db.batch([
   db.prepare('UPDATE attorneys SET company=\'\',owner_edited=1 WHERE '+where).bind(...args),
   db.prepare('DELETE FROM google_firm_arrivals WHERE firm_key IN (?,?)').bind(key,requestedKey),db.prepare('DELETE FROM firm_search_events WHERE firm_key IN (?,?)').bind(key,requestedKey),
   db.prepare('DELETE FROM firm_settings WHERE key IN (?,?)').bind(key,requestedKey),
   db.prepare('DELETE FROM firm_owners WHERE firm_key IN (?,?)').bind(key,requestedKey),
   db.prepare('DELETE FROM firm_claims WHERE firm_key IN (?,?)').bind(key,requestedKey),
   db.prepare('DELETE FROM firm_messages WHERE firm_key IN (?,?)').bind(key,requestedKey),
   db.prepare("UPDATE directory_submissions SET status='deleted',review_note='Firm removed by administrator.',reviewed_at=?,reviewed_by=? WHERE kind='firm' AND "+firmColumn('name')+' IN (?,?)').bind(now,actor,key,requestedKey),
   db.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,'firm-delete',key,now)
  ]);return true;
 }
 if(kind!=='attorneys')throw Error('Choose an attorney or firm.');
 const attorney=await db.prepare('SELECT state,COALESCE(license_number,bar_number) AS license FROM attorneys WHERE bar_number=?').bind(id).first<{state:string;license:string}>();if(!attorney)return false;
 // Dependents are removed before their parent, in one atomic transaction.
 const statements=['client_verification_audit','client_approval_emails','client_verification_request_emails','client_rejection_emails','review_moderation_emails'].map(table=>db.prepare('DELETE FROM '+table+' WHERE verification_id IN (SELECT id FROM client_verifications WHERE bar_number=?)').bind(id));
 statements.push(db.prepare('DELETE FROM referral_notifications WHERE lead_id IN (SELECT id FROM client_leads WHERE attorney_bar=?)').bind(id));
 for(const table of ['client_verifications','shortlist','profile_claims','attorney_profiles','attorney_search_events','attorney_profile_views'])statements.push(db.prepare('DELETE FROM '+table+' WHERE bar_number=?').bind(id));
 statements.push(
  db.prepare("UPDATE directory_submissions SET status='deleted',review_note='Attorney removed by administrator.',reviewed_at=?,reviewed_by=? WHERE kind='lawyer' AND state=? AND bar_number=?").bind(now,actor,attorney.state,attorney.license),
  db.prepare('DELETE FROM attorneys WHERE bar_number=?').bind(id),
  db.prepare('INSERT INTO admin_audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,'attorney-delete',licenseKey(attorney.state,attorney.license||id),now)
 );await db.batch(statements);return true;
}
