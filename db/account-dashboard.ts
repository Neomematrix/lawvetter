import {accountFirm} from './account-firm';
import {rawDb} from './raw';
import {decodeAttorneyDraft} from './attorney-submission';

export async function accountDashboardPath(client:{user:string;email:string},preferAttorney=false) {
 if(!preferAttorney&&await accountFirm(client.user))return '/client-reviews';
 const db=rawDb();
 const linked=await db.prepare("SELECT EXISTS(SELECT 1 FROM attorney_profiles WHERE owner_id=?) OR EXISTS(SELECT 1 FROM profile_claims WHERE user_id=?) AS attorney_workspace").bind(client.user,client.user).first<{attorney_workspace:number}>();
 if(linked?.attorney_workspace)return '/account';
 const submissions=await db.prepare('SELECT notes FROM directory_submissions WHERE submitter_email=?').bind(client.email).all<{notes:string}>();
 return submissions.results.some(r=>decodeAttorneyDraft(r.notes)?.owner===client.user)?'/account':'/client-reviews';
}
