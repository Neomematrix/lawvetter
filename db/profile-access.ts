import {env} from 'cloudflare:workers';
export function profileIdentity(request:Request){
 const user=request.headers.get('oai-authenticated-user-id')||'';
 const email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
 return {user,email,admin:!!user&&!!email&&!!env.CLAIM_ADMIN_EMAIL&&email===env.CLAIM_ADMIN_EMAIL.trim().toLowerCase()};
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
