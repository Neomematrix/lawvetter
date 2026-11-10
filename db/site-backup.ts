import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {projectId} from './site-settings';
import {encryptBackup,base64} from './backup-format';
const ephemeral=new Set(['admin_sessions','client_sessions','admin_challenges','admin_password_tokens','client_password_reset_tokens','client_auth_limits']);
export async function* backupRecords(){
 const db=rawDb(),tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{name:string}>(),counts:Record<string,number>={};
 for(const {name} of tables.results){if(name==='search_index_progress'||/^(attorney|firm)_search_fts($|_)/.test(name)||ephemeral.has(name)||! /^[a-z_][a-z0-9_]*$/.test(name))continue;let offset=0;counts[name]=0;while(true){const rows=await db.prepare('SELECT * FROM '+name+' ORDER BY rowid LIMIT 250 OFFSET ?').bind(offset).all();if(!rows.results.length)break;yield {kind:'rows',table:name,rows:rows.results};counts[name]+=rows.results.length;offset+=rows.results.length;}}
 const configuration=env as unknown as Record<string,unknown>,keys=['ADMIN_MFA_ENCRYPTION_KEY','APPROVAL_EMAIL_FROM','CLAIM_ADMIN_EMAIL','RESEND_API_KEY','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','DIRECTORY_CAPTCHA_REQUIRED','GA_MEASUREMENT_ID','NEXT_PUBLIC_GA_MEASUREMENT_ID','PUBLIC_SITE_ORIGIN','GOOGLE_SITE_VERIFICATION','BING_SITE_VERIFICATION'];yield {kind:'runtime',values:Object.fromEntries(keys.filter(k=>typeof configuration[k]==='string').map(k=>[k,configuration[k]]))};
 let cursor:string|undefined,objects=0;do{const list=await env.PROFILE_PHOTOS.list({cursor,limit:100});for(const object of list.objects){if(object.key.startsWith('backups/'))continue;const file=await env.PROFILE_PHOTOS.get(object.key);if(!file)throw Error('A photo changed during backup. Retry the export.');const bytes=new Uint8Array(await file.arrayBuffer());yield {kind:'object',key:object.key,contentType:file.httpMetadata?.contentType||'application/octet-stream',data:base64(bytes)};objects++;}cursor=list.truncated?list.cursor:undefined;}while(cursor);
 yield {kind:'complete',counts,objects};
}
export async function createSiteBackup(passphrase:string){const key='backups/'+crypto.randomUUID()+'.lvbackup',upload=await env.PROFILE_PHOTOS.createMultipartUpload(key,{httpMetadata:{contentType:'application/octet-stream'}}),parts:{partNumber:number;etag:string}[]=[];let buffer=new Uint8Array(0),size=0;
 async function send(bytes:Uint8Array){const partNumber=parts.length+1;parts.push(await upload.uploadPart(partNumber,bytes));size+=bytes.length;}
 try{for await(const chunk of encryptBackup(backupRecords(),passphrase,projectId)){const joined=new Uint8Array(buffer.length+chunk.length);joined.set(buffer);joined.set(chunk,buffer.length);buffer=joined;while(buffer.length>=5*1024*1024){await send(buffer.slice(0,5*1024*1024));buffer=buffer.slice(5*1024*1024);}}if(buffer.length)await send(buffer);await upload.complete(parts);return {key,size};}catch(e){await upload.abort();throw e;}
}
