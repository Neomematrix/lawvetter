import {normalizeLanguages} from '../app/languages';
import {submittedFirmStatement} from './submitted-firm';
import {isActiveMembership} from '../app/membership-status';
import {requireGeorgiaIdentity} from '../app/attorney-identity';
import {validatedMembershipStatus} from '../app/membership-status';
import {requireAttorneyLocation} from '../app/attorney-location';
import {directoryInsertGuard,licenseKey,firmDeletionKey} from './directory-deletions';
import {approvedListingRepair} from './approved-listing-repairs';
import {licensedAttorney,directoryAttorneyId} from './attorney-identity';
import {directoryFirmName} from './directory-firm';
import {rawDb} from './raw';
import {decodeAttorneyDraft} from './attorney-submission';
import {directoryDetails} from './directory-details';
export const membershipStatuses=['Member in Good Standing','Active'];
export type Listing={id:string;kind:string;name:string;firm_name:string;state:string;bar_number:string;city:string;website:string;official_source_url:string;notes:string;status:string;reviewed_by?:string};
export async function publishDirectoryListing(item:Listing,status:string,reviewer:string,note:string){
 status=validatedMembershipStatus(status);
 requireAttorneyLocation(item.city,item.state);
 if(!isActiveMembership(status))throw Error('Only verified active members may be listed.');
 requireGeorgiaIdentity(item.state,item.bar_number,item.official_source_url);
 if(item.kind!=='lawyer'||(!!item.bar_number&&!/^[A-Za-z0-9]{1,20}$/.test(item.bar_number))||!membershipStatuses.includes(status))throw Error('Enter a valid bar number and verified membership status.');
 const db=rawDb(),existing=await licensedAttorney(item.state,item.bar_number,item.official_source_url),attorneyId=await directoryAttorneyId(item.state,item.bar_number,item.official_source_url);
 if(existing)throw Error(`${item.state} license #${item.bar_number} is already listed as ${existing.name}. Review that profile instead.`);
 const now=new Date().toISOString(),details=directoryDetails(item.notes),firmName=await directoryFirmName(item.firm_name);
 const firmStatement=submittedFirmStatement(firmName,item.notes,item.id,now);
 const result=await db.batch([
  db.prepare("INSERT INTO attorneys(bar_number,license_number,source_id,name,company,city,state,zip,address,county,status,admit_date,law_school,phone,email,source_url,imported_at) SELECT ?,NULLIF(bar_number,''),'owner-reviewed:'||id,name,?,city,state,?,?,?,?,?,?,?,?,?,? FROM directory_submissions WHERE id=? AND kind='lawyer' AND status IN ('pending','approved_for_import') AND notes=? AND "+directoryInsertGuard).bind(attorneyId,firmName,details.zip||'',details.address||'',details.county||'',status,details.admitDate||'',details.lawSchool||'',details.phone||'',details.publicEmail||'',item.official_source_url,now,item.id,item.notes,licenseKey(item.state,item.bar_number||attorneyId),firmDeletionKey(firmName)),
  db.prepare("INSERT INTO attorney_profiles(bar_number,languages,owner_id,bio,practice_areas,website,linkedin_url,photo_key,claimed_at,updated_at) SELECT ?,?,'',?,?,?,?,?, '',? FROM directory_submissions WHERE id=? AND status IN ('pending','approved_for_import') AND notes=?").bind(attorneyId,normalizeLanguages(details.languages),details.biography||'',details.practiceAreas||'',item.website,details.linkedinUrl??null,details.photoKey||'',now,item.id,item.notes),
  ...(firmStatement?[firmStatement]:[]),
  db.prepare("UPDATE directory_submissions SET status='published',review_note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status IN ('pending','approved_for_import') AND notes=?").bind(note,now,reviewer,item.id,item.notes)
 ]);if(!result[result.length-1].meta.changes)throw Error('This submission changed during publication. Reload and try again.');
}
// Repair only records already approved by the administrator; never auto-approve submissions.
export async function reconcileApprovedListings(){const db=rawDb(),rows=await db.prepare("SELECT * FROM directory_submissions WHERE kind='lawyer' AND status='approved_for_import' AND reviewed_by IS NOT NULL AND reviewed_by<>'' ORDER BY reviewed_at DESC LIMIT 5").all<Listing>();let published=0;for(const item of rows.results){if(decodeAttorneyDraft(item.notes)||item.state!=='FL')continue;try{const repair=approvedListingRepair;if(item.id===repair.id&&item.name===repair.name&&item.state===repair.state&&item.bar_number===repair.bar){await publishDirectoryListing({...item,official_source_url:repair.source},repair.status,item.reviewed_by!,'Historical approval repaired. Membership status sourced from the indexed official Florida Bar profile on 2026-10-12; live registry access was unavailable.');published++;continue;}const source=new URL(item.official_source_url);if(source.hostname!=='www.floridabar.org'&&source.hostname!=='floridabar.org')continue;if(source.searchParams.get('num')!==item.bar_number)continue;const official='https://www.floridabar.org/about/section/profile/?num='+item.bar_number;const r=await fetch(official,{signal:AbortSignal.timeout(10000)});if(!r.ok)continue;const html=(await r.text()).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').toLowerCase();if(!html.includes(item.name.toLowerCase())||!html.includes(item.bar_number)||!html.includes('member in good standing')||!html.includes('eligible to practice law in florida'))continue;await publishDirectoryListing({...item,official_source_url:official},'Active Member in Good Standing',item.reviewed_by!,'Previously approved listing published after checking the official Florida Bar record.');published++;}catch{}}return published;}
