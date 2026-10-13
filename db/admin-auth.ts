import {env} from 'cloudflare:workers';
import {randomBytes,createHash} from 'node:crypto';
import {rawDb} from './raw';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export const adminCookieName='__Host-lawvetter-admin';
export const adminEmail=()=>((env as unknown as {CLAIM_ADMIN_EMAIL?:string}).CLAIM_ADMIN_EMAIL||'').trim().toLowerCase();
export function adminToken(request:Request){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(adminCookieName+'='))?.slice(adminCookieName.length+1)||'';}
export function adminCookie(token:string){return `${adminCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token?28800:0}`;}
export async function adminIdentity(request:Request){const token=adminToken(request),email=adminEmail();if(!email||! /^[a-f0-9]{64}$/.test(token))return null;const row=await rawDb().prepare('SELECT s.email FROM admin_sessions s JOIN admin_credentials a ON a.email=s.email WHERE s.token_hash=? AND s.email=? AND s.expires_at>?').bind(digest(token),email,Date.now()).first<{email:string}>();return row?{user:'admin:'+row.email,email:row.email,admin:true}:null;}
export async function createAdminSession(email:string){const token=randomBytes(32).toString('hex');await rawDb().prepare('INSERT INTO admin_sessions(token_hash,email,expires_at) VALUES(?,?,?)').bind(digest(token),email,Date.now()+28800000).run();return token;}
