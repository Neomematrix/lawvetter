import {adminIdentity} from './admin-auth';
export async function profileIdentity(request:Request){
 const admin=await adminIdentity(request);if(admin)return admin;
 const user=request.headers.get('oai-authenticated-user-id')||'';
 const email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
 return {user,email,admin:false};
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
