import {env} from 'cloudflare:workers';
import {adminIdentity} from '../../../../db/admin-auth';
import {rawDb} from '../../../../db/raw';
import {resolveAttorneyReference} from '../../../../db/attorney-reference';
import {directoryDetails} from '../../../../db/directory-details';
import {decodeAttorneyDraft} from '../../../../db/attorney-submission';

const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
type PhotoRow={bar_number:string;name:string;photo_key:string;public_id:string|null};
export async function GET(request:Request){
 if(!await adminIdentity(request))return reply({error:'Sign in as administrator.'},401);
 try{
  const params=new URL(request.url).searchParams,db=rawDb(),mode=params.get('mode')||'summary';
  if(mode==='summary'){
   const summary=await db.prepare("SELECT count(*) AS attorneys,sum(CASE WHEN trim(COALESCE(p.photo_key,''))='' THEN 1 ELSE 0 END) AS withoutPhoto,sum(CASE WHEN p.photo_key LIKE 'https://%' THEN 1 ELSE 0 END) AS externalPhotos,sum(CASE WHEN trim(COALESCE(p.photo_key,''))<>'' AND p.photo_key NOT LIKE 'https://%' THEN 1 ELSE 0 END) AS storedPhotos FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number").first();
   const target=await resolveAttorneyReference(params.get('target')||'');
   const attorney=target?await db.prepare('SELECT a.bar_number,a.name,a.state,a.license_number,a.public_id,p.photo_key,p.updated_at FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE a.bar_number=?').bind(target).first<PhotoRow&{state:string;license_number:string;updated_at:string}>():null;
   const candidates:{key:string;uploaded:string;source:string}[]=[];
   if(attorney){let cursor:string|undefined;do{const list=await env.PROFILE_PHOTOS.list({prefix:'attorneys/'+target+'/',limit:100,cursor});for(const o of list.objects)candidates.push({key:o.key,uploaded:o.uploaded.toISOString(),source:'Attorney upload'});cursor=list.truncated?list.cursor:undefined;}while(cursor);
    const submissions=await db.prepare("SELECT id,notes FROM directory_submissions WHERE kind='lawyer' AND state=? AND (bar_number=? OR lower(name)=lower(?))").bind(attorney.state,attorney.license_number||target,attorney.name).all<{id:string;notes:string}>();
    for(const s of submissions.results){const key=decodeAttorneyDraft(s.notes)?.photoKey||directoryDetails(s.notes).photoKey;if(key&&await env.PROFILE_PHOTOS.head(key))candidates.push({key,uploaded:'',source:'Submission '+s.id});}
   }
   return reply({summary,attorney,candidates});
  }
  if(mode==='references'){
   const after=(params.get('after')||'').slice(0,200);
   const {results}=await db.prepare("SELECT a.bar_number,a.name,a.public_id,p.photo_key FROM attorneys a JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE trim(p.photo_key)<>'' AND p.photo_key NOT LIKE 'https://%' AND a.bar_number>? ORDER BY a.bar_number LIMIT 25").bind(after).all<PhotoRow>();
   let available=0;const missing:PhotoRow[]=[],errors:{name:string;bar_number:string}[]=[];
   for(let i=0;i<results.length;i+=5)await Promise.all(results.slice(i,i+5).map(async row=>{try{if(await env.PROFILE_PHOTOS.head(row.photo_key))available++;else missing.push(row);}catch{errors.push({name:row.name,bar_number:row.bar_number});}}));
   return reply({checked:results.length,available,missing,errors,next:results.length===25?results.at(-1)!.bar_number:null});
  }
  if(mode==='objects'){
   const prefix=params.get('prefix')==='submissions/'?'submissions/':'attorneys/',cursor=params.get('cursor')||undefined;
   if(cursor&&cursor.length>4000)return reply({error:'Invalid cursor.'},400);
   const list=await env.PROFILE_PHOTOS.list({prefix,limit:100,cursor}),keys=list.objects.map(o=>o.key),ids=[...new Set(keys.filter(k=>k.startsWith('attorneys/')).map(k=>k.split('/')[1]))];
   const {results}=await db.prepare('SELECT a.bar_number,a.name,a.public_id,p.photo_key FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE a.bar_number IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all<PhotoRow>();
   const byId=new Map(results.map(r=>[r.bar_number,r]));
   const lostLinks=list.objects.flatMap(o=>{const r=byId.get(o.key.split('/')[1]);return r&&!r.photo_key?[{...r,key:o.key,uploaded:o.uploaded.toISOString()}]:[];});
   return reply({objects:list.objects.length,lostLinks,next:list.truncated?list.cursor:null});
  }
  return reply({error:'Unknown audit mode.'},400);
 }catch(error){console.error('Photo audit failed',error);return reply({error:'Photo audit could not complete. Retry without changing any photos.'},503);}
}
