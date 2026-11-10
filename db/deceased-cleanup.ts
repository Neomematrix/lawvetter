import {rawDb} from './raw';
// A bounded atomic cleanup. Recheck status inside the transaction so a corrected
// record is not deleted between selection and execution.
export async function removeDeceasedBatch(actor:string){
 const db=rawDb(),now=new Date().toISOString();
 const {results}=await db.prepare("SELECT bar_number FROM attorneys WHERE lower(trim(status))='deceased' ORDER BY bar_number LIMIT 250").all<{bar_number:string}>();
 if(!results.length)return {removed:0,remaining:0};
 const ids=JSON.stringify(results.map(r=>r.bar_number));
 const selected="SELECT bar_number FROM attorneys WHERE lower(trim(status))='deceased' AND bar_number IN (SELECT value FROM json_each(?))";
 const statements=[db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT lower(hex(randomblob(16))),?,'attorney-delete',upper(state)||':'||COALESCE(license_number,bar_number),? FROM attorneys WHERE bar_number IN ("+selected+")").bind(actor,now,ids)];
 for(const table of ['client_verification_audit','client_approval_emails','client_verification_request_emails','client_rejection_emails','review_moderation_emails'])statements.push(db.prepare('DELETE FROM '+table+' WHERE verification_id IN (SELECT id FROM client_verifications WHERE bar_number IN ('+selected+'))').bind(ids));
 statements.push(db.prepare('DELETE FROM referral_notifications WHERE lead_id IN (SELECT id FROM client_leads WHERE attorney_bar IN ('+selected+'))').bind(ids));
 for(const table of ['client_verifications','shortlist','profile_claims','attorney_profiles','attorney_search_events','attorney_profile_views'])statements.push(db.prepare('DELETE FROM '+table+' WHERE bar_number IN ('+selected+')').bind(ids));
 statements.push(db.prepare("UPDATE directory_submissions SET status='deleted',review_note='Deceased attorney removed by administrator.',reviewed_at=?,reviewed_by=? WHERE kind='lawyer' AND EXISTS(SELECT 1 FROM attorneys a WHERE a.bar_number IN ("+selected+") AND a.state=directory_submissions.state AND COALESCE(a.license_number,a.bar_number)=directory_submissions.bar_number)").bind(now,actor,ids));
 statements.push(db.prepare('DELETE FROM attorneys WHERE bar_number IN ('+selected+')').bind(ids));
 const saved=await db.batch(statements),remaining=await db.prepare("SELECT count(*) AS total FROM attorneys WHERE lower(trim(status))='deceased'").first<{total:number}>();
 return {removed:saved[saved.length-1].meta.changes,remaining:remaining?.total||0};
}
