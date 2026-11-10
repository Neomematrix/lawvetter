import {viewAsToken} from './view-as-cookie';
import {env} from 'cloudflare:workers';
import {randomBytes,createHash} from 'node:crypto';
import {rawDb} from './raw';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export const adminCookieName='__Host-lawvetter-admin';
export const adminSessionSeconds=3*60*60;
export const adminSessionMs=adminSessionSeconds*1000;
export const adminEmail=()=>((env as unknown as {CLAIM_ADMIN_EMAIL?:string}).CLAIM_ADMIN_EMAIL||'').trim().toLowerCase();
export function adminToken(request:Request){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(adminCookieName+'='))?.slice(adminCookieName.length+1)||'';}
export function adminCookie(token:string){return `${adminCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token?adminSessionSeconds:0}`;}
export async function adminIdentity(request:Request,options:{allowViewAs?:boolean}={}){if(viewAsToken(request)&&!options.allowViewAs)return null;const token=adminToken(request),email=adminEmail(),now=Date.now();if(!email||! /^[a-f0-9]{64}$/.test(token))return null;const hash=digest(token),row=await rawDb().prepare('SELECT s.email,s.last_seen FROM admin_sessions s JOIN admin_credentials a ON a.email=s.email WHERE s.token_hash=? AND s.email=? AND s.expires_at>? AND s.last_seen>?').bind(hash,email,now,now-adminSessionMs).first<{email:string;last_seen:number}>();if(!row)return null;if(row.last_seen<now-60000)await rawDb().prepare('UPDATE admin_sessions SET last_seen=? WHERE token_hash=? AND expires_at>? AND last_seen>?').bind(now,hash,now,now-adminSessionMs).run();return {user:'admin:'+row.email,email:row.email,admin:true};}
export async function createAdminSession(email:string){const token=randomBytes(32).toString('hex');await rawDb().prepare('INSERT INTO admin_sessions(token_hash,email,expires_at,last_seen) VALUES(?,?,?,?)').bind(digest(token),email,Date.now()+adminSessionMs,Date.now()).run();return token;}
