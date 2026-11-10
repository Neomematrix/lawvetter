import {rawDb} from './raw';
// Delete only the signed-in user's account data. Release directory ownership
// in the same transaction without removing attorney records or other clients' reviews.
export async function deleteOwnAccount(user:string){
 const db=rawDb(),now=new Date().toISOString();
 const statements=[db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT lower(hex(randomblob(16))),?,'account-claim-release',bar_number,? FROM attorney_profiles WHERE owner_id=?").bind(user,now,user)];
 const verification='SELECT id FROM client_verifications WHERE user_id=?';
 for(const table of ['client_verification_audit','client_approval_emails','client_verification_request_emails','client_rejection_emails','review_moderation_emails'])statements.push(db.prepare('DELETE FROM '+table+' WHERE verification_id IN ('+verification+')').bind(user));
 statements.push(db.prepare('DELETE FROM referral_notifications WHERE owner_id=?').bind(user));
 statements.push(db.prepare('DELETE FROM firm_owners WHERE user_id=?').bind(user),db.prepare('DELETE FROM firm_claims WHERE user_id=?').bind(user));
 for(const table of ['client_verifications','shortlist','profile_claims'])statements.push(db.prepare('DELETE FROM '+table+' WHERE user_id=?').bind(user));
 statements.push(db.prepare("UPDATE directory_submissions SET status='deleted',review_note='Pending submission withdrawn following account deletion.',reviewed_at=?,reviewed_by='account-deletion' WHERE submitter_email IN (SELECT email FROM client_profiles WHERE user_id=?) AND status IN ('pending','approved_for_import')").bind(now,user));
 statements.push(db.prepare("UPDATE attorney_profiles SET owner_id='',claimed_at='',updated_at=? WHERE owner_id=?").bind(now,user));
 for(const table of ['client_sessions','client_password_reset_tokens','client_passwords','client_account_emails'])statements.push(db.prepare('DELETE FROM '+table+' WHERE user_id=?').bind(user));
 statements.push(db.prepare('DELETE FROM client_profiles WHERE user_id=?').bind(user));
 await db.batch(statements);
}
