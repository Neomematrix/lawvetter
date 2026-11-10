import {createHash} from 'node:crypto';
import {adminIdentity,adminToken} from './admin-auth';
import {rawDb} from './raw';
import {viewAsToken} from './view-as-cookie';
export const viewAsDigest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function viewAsIdentity(request:Request){
 const token=viewAsToken(request);
 if(!/^[a-f0-9]{64}$/.test(token)||!await adminIdentity(request,{allowViewAs:true}))return null;
 return rawDb().prepare('SELECT p.user_id AS user,p.email,p.legal_name AS name FROM admin_user_views v JOIN client_profiles p ON p.user_id=v.user_id WHERE v.token_hash=? AND v.admin_token_hash=? AND v.expires_at>?').bind(viewAsDigest(token),viewAsDigest(adminToken(request)),Date.now()).first<{user:string;email:string;name:string}>();
}
