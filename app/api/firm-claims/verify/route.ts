import {rawDb} from '../../../../db/raw';
import {trustedFirmEmail} from '../../../../db/firm-claim-auto';
import {firmRecord} from '../../../../db/firm-access';
import {firmClaimHash} from '../../../../db/firm-claim-email';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid request origin.'},{status:403,headers});
 try{const text=await request.text();if(text.length>300)return Response.json({error:'Invalid confirmation.'},{status:400,headers});const data=JSON.parse(text);if(typeof data?.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token))return Response.json({error:'Invalid link.'},{status:400,headers});
 const db=rawDb(),hash=firmClaimHash(data.token),now=new Date().toISOString();
 const claim=await db.prepare("SELECT id,firm_key,firm_email FROM firm_claims WHERE email_token_hash=? AND status='pending' AND firm_email_verified_at IS NULL").bind(hash).first<{id:string;firm_key:string;firm_email:string}>();
 if(!claim)return Response.json({error:'This link was replaced, was already used, or the request is no longer pending. Request another email from Firm access.'},{status:400,headers});
 const automatic=!!await firmRecord(claim.firm_key)&&await trustedFirmEmail(claim.firm_key,claim.firm_email);
 const results=await db.batch([
 db.prepare("UPDATE firm_claims SET firm_email_verified_at=?,email_token_hash='',email_token_expires=0 WHERE id=? AND email_token_hash=? AND status='pending' AND firm_email_verified_at IS NULL").bind(now,claim.id,hash),
 db.prepare("INSERT OR IGNORE INTO firm_owners(firm_key,user_id,claim_id,approved_at) SELECT firm_key,user_id,id,? FROM firm_claims WHERE id=? AND ?=1 AND changes()>0 AND status='pending' AND firm_email_verified_at=? AND EXISTS(SELECT 1 FROM client_profiles WHERE user_id=firm_claims.user_id)").bind(now,claim.id,automatic?1:0,now),
 db.prepare("UPDATE firm_claims SET status='approved',reviewed_at=?,reviewed_by='system:firm-email',review_note='Automatically approved after confirming an email on the recorded firm domain.' WHERE id=? AND changes()>0 AND status='pending' AND EXISTS(SELECT 1 FROM firm_owners WHERE claim_id=firm_claims.id)").bind(now,claim.id),
 db.prepare("INSERT INTO admin_audit(id,actor,action,record_id,created_at) SELECT ?,'system:firm-email','firm-access-auto-approved',?,? WHERE changes()>0").bind(crypto.randomUUID(),claim.firm_key,now),
 db.prepare("INSERT INTO firm_settings(key,name,updated_at) SELECT firm_key,firm_name,? FROM firm_claims WHERE id=? AND status='approved' AND EXISTS(SELECT 1 FROM firm_owners WHERE claim_id=firm_claims.id) ON CONFLICT(key) DO NOTHING").bind(now,claim.id)
 ]);
 if(!results[0].meta.changes)return Response.json({error:'This link was already used or replaced.'},{status:400,headers});
 return Response.json({confirmed:true,approved:!!results[2].meta.changes},{headers});
 }catch{return Response.json({error:'Unable to confirm the email. Please try again.'},{status:503,headers});}
}
