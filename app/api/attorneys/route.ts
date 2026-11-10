import {searchIndexReady,nameIndexFilter,firmIndexFilter} from '../../../db/search-index';
import {backgroundTask} from '../../../db/background-task';
import {readDeadline} from '../../read-json';
import {searchInputError} from './search-input';
import {firmRosterRankingSQL} from '../../../db/firm-roster-ranking';
import {readFirmLocations} from '../../firm-locations';
import {publishedFirmBiography,submittedFirmSettings} from '../../../db/submitted-firm';
import {activeMembershipSQL} from '../../../db/active-membership';
import {resolveAttorneyReference} from '../../../db/attorney-reference';
import {profileIdsResponse} from '../../../db/public-records';
import {publicLicenseColumn,publicAttorneyColumns} from '../../../db/public-attorney';
import {zipRadius} from '../../../db/zip-radius';
import {searchRadius} from '../../search-radius';
import {DIRECTORY_PAGE_SIZE} from '../../directory-page-size';
import {linkedFirmContact} from '../../../db/firm-contact';
import {allowRankedSearch} from '../../../db/ranking-search';
import {ownershipVerifiedColumn} from '../../../db/attorney-verification';
import {firmDeleted} from '../../../db/directory-deletions';
import {practiceCatalog} from '../../../db/practice-categories';
import {practiceCategoryId} from '../../practice-category';
import {verifiedFirmRoster} from '../../verified-firm-rosters';
import {practiceSources,searchPracticeArea} from '../../practice-areas';
import {monthStart} from './charts';
import {publicDiscoveryData} from '../../../db/public-discovery';
import { rawDb } from '../../../db/raw';
import { firmKey, firmColumn } from './firm';
import { attorneyNameSearch, textWordSearch, closeNameCandidates } from './search';
import {stateSearch} from '../../us-states';
const fields = ownershipVerifiedColumn()+','+'(SELECT languages FROM attorney_profiles p WHERE p.bar_number=attorneys.bar_number) AS languages,'+'(SELECT practice_areas FROM attorney_profiles p WHERE p.bar_number=attorneys.bar_number) AS practice_areas,zip,owner_edited,public_id,bar_number,'+publicLicenseColumn()+',name,company,employment_type,employer_name,employer_website,city,state,county,status,admit_date,imported_at,(SELECT photo_key FROM attorney_profiles p WHERE p.bar_number=attorneys.bar_number) AS photo_key';
async function handle(parameters: Record<string, string>, record = false,request?:Request):Promise<Response> {
 try {
  const invalid=searchInputError(parameters);
  if(invalid)return Response.json({error:invalid},{status:400});
  const db = rawDb(), id = parameters.id?await resolveAttorneyReference(parameters.id):undefined;
  if(parameters.id&&!id)return Response.json({error:'Attorney not found.'},{status:404});
  const suggest = !record && parameters.suggest === '1';
  if (parameters.firm !== undefined) {
   const key=firmKey(parameters.firm.slice(0,500));
   if(!key)return Response.json({error:'Enter a firm name.'},{status:400});
   if(await db.prepare("SELECT 1 FROM firm_settings WHERE key=? AND organization_type<>'Law Firm'").bind(key).first())return Response.json({error:'This organization is not a law firm.'},{status:404});
   if(await firmDeleted(key))return Response.json({error:'This firm is no longer listed.'},{status:404});
   const page=Math.max(1,Math.min(10000,Number.parseInt(parameters.page||'1')||1));
   const roster=verifiedFirmRoster(key);
   const rosterWhere=roster?"((owner_edited=0 AND employment_type='Law Firm Attorney' AND bar_number IN (SELECT value FROM json_each(?))) OR "+firmColumn()+' = ?)':firmColumn()+' = ?';
   const where='('+rosterWhere+') AND '+activeMembershipSQL();
   const rosterBindings=roster?[JSON.stringify(roster.bars),key]:[key];
   const [rows,summary]=await Promise.all([
    db.prepare(firmRosterRankingSQL(fields,where,DIRECTORY_PAGE_SIZE)).bind(...rosterBindings,monthStart(),new Date().toISOString(),(page-1)*DIRECTORY_PAGE_SIZE).all(),
    db.prepare("SELECT count(*) AS total,sum(CASE WHEN lower(trim(status)) IN ('active member in good standing','member in good standing') THEN 1 ELSE 0 END) AS active,max(imported_at) AS updated,min(company) AS name FROM attorneys WHERE "+where).bind(...rosterBindings).first<{total:number;active:number;updated:string;name:string}>(),
   ]);
   const firmContact=await db.prepare('SELECT name,address,phone,email,city,state,zip,additional_locations,practice_areas,updated_at FROM firm_settings WHERE key=?').bind(key).first<{name:string;address:string;phone:string;email:string;city:string;state:string;zip:string;additional_locations:string;practice_areas:string;updated_at:string}>();
   if(!summary?.total&&!firmContact?.name)return Response.json({error:'No firm records were found. Check the firm name and try again.'},{status:404});
   const office=firmContact?.address?firmContact:await db.prepare('SELECT address,city,state,zip FROM attorneys WHERE '+where+" AND trim(address)<>'' ORDER BY address,city,state,zip LIMIT 1").bind(...rosterBindings).first<{address:string;city:string;state:string;zip:string}>();
   const firmSetting=await db.prepare('SELECT website,linkedin_url FROM firm_settings WHERE key=?').bind(key).first<{website:string;linkedin_url:string|null}>(),submitted=await submittedFirmSettings(key),firmWebsite=submitted.website||'';
   const contact=await linkedFirmContact(key,{website:firmWebsite,phone:firmContact?.phone});
   if(record && request && parameters.eventId && /^[0-9a-f-]{36}$/i.test(parameters.eventId))await backgroundTask('Firm ranking update failed',async()=>{if(await allowRankedSearch(request,'firm:'+key,parameters.eventId))await db.prepare('INSERT OR IGNORE INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').bind(parameters.eventId,key,firmContact?.name||summary?.name||parameters.firm,new Date().toISOString()).run();});
   const ownership=await db.prepare("SELECT EXISTS(SELECT 1 FROM firm_owners fo JOIN firm_claims fc ON fc.id=fo.claim_id JOIN client_profiles cp ON cp.user_id=fo.user_id WHERE fo.firm_key=? AND fc.status='approved' AND fc.firm_email_verified_at IS NOT NULL) AS verified").bind(key).first<{verified:number}>();
   const additionalLocations=readFirmLocations(firmContact?.additional_locations);
   const officeCities=[office?.city||firmContact?.city||'',...additionalLocations.map(location=>location.city)].map(city=>city.trim()).filter(Boolean);
   const cities=officeCities.filter((city,index)=>officeCities.findIndex(other=>other.toLowerCase()===city.toLowerCase())===index);
   return Response.json({firm:{ownershipVerified:ownership?.verified===1,practiceAreas:firmContact?.practice_areas||'',logoVersion:firmContact?.updated_at||'4',additionalLocations,name:firmContact?.name||(firmSetting?summary?.name:roster?.name||summary?.name)||parameters.firm,address:office?.address||'',city:office?.city||firmContact?.city||'',state:office?.state||firmContact?.state||'',zip:office?.zip||firmContact?.zip||'',phone:contact.phone,email:firmContact?.email||'',biography:await publishedFirmBiography(key),website:contact.website,websiteEdited:!!firmSetting?.website?.trim(),linkedinUrl:submitted.linkedin_url,verifiedRoster:firmSetting?null:roster,total:summary?.total||0,active:summary?.active||0,updated:summary?.updated||'',cities},attorneys:roster?rows.results.map(a=>({...a,company:(a as {owner_edited?:number}).owner_edited?(a as {company:string}).company:roster.name})):rows.results,page});
  }
  if(parameters.home==='1')return Response.json(await publicDiscoveryData(db));
  if(id && !record) {
   const attorney=await db.prepare('SELECT '+publicAttorneyColumns()+' FROM attorneys WHERE '+activeMembershipSQL()+' AND bar_number = ?').bind(id).first();
   return Response.json({attorney},{status:attorney?200:404});
  }
  const catalog=(!suggest&&(parameters.practice||parameters.q||parameters.categories==='1'))?await practiceCatalog(db):null;
  if(parameters.categories==='1')return Response.json({areas:catalog!.areas});
  const typedArea=parameters.practice?undefined:searchPracticeArea(parameters.q||'')||catalog?.areas.find(area=>area.id===practiceCategoryId(parameters.q||''));
  const q=(typedArea?'':parameters.q||'').trim().slice(0,150).toLowerCase(), city=(parameters.city||'').trim().slice(0,100).toLowerCase(), status=(parameters.status||'').trim().slice(0,100);
  const page=Math.min(10000,Math.max(1,Number.parseInt(parameters.page||'1')||1));
  const indexReady=q?await searchIndexReady(db):false;
  if(parameters.kind==='firms'){
   const key=firmKey(q),parts:string[]=[],values:string[]=[];
   if(key){const words=textWordSearch(q,"company");parts.push("("+firmColumn()+" LIKE ? ESCAPE '\\' OR "+words.where+")");values.push('%'+key.replace(/[\\%_]/g,'\\$&')+'%',...words.args);}
   const firmLocation=(alias:string)=>{const state=stateSearch(city),location=city.match(/^(.+),\s*([a-z]{2})$/i);if(state)return {where:alias+'state = ?',args:[state]};if(location)return {where:'lower('+alias+'city)=? AND '+alias+'state=?',args:[location[1].trim(),location[2].toUpperCase()]};return {where:'lower('+alias+'city)=?',args:[city]};};
   if(indexReady&&key){const indexed=firmIndexFilter(q,key);if(indexed){parts.push(indexed.where);values.push(...indexed.args);}}
   if(city){const location=firmLocation('');parts.push(location.where);values.push(...location.args);}
   if(!parts.length)return Response.json({error:'Enter a firm name or city.'},{status:400});
   const standaloneParts=["f.organization_type='Law Firm'","f.name<>''","NOT EXISTS(SELECT 1 FROM attorneys a WHERE "+firmColumn('a.company')+"=+f.key AND "+activeMembershipSQL('a')+")"],standaloneValues:string[]=[];
   if(key){const words=textWordSearch(q,"f.name");standaloneParts.push("(f.key LIKE ? ESCAPE '\\' OR "+words.where+")");standaloneValues.push('%'+key.replace(/[\\%_]/g,'\\$&')+'%',...words.args);}if(city){const location=firmLocation('f.');standaloneParts.push(location.where);standaloneValues.push(...location.args);}
   if(indexReady&&key){const indexed=firmIndexFilter(q,key,true);if(indexed){standaloneParts.push(indexed.where);standaloneValues.push(...indexed.args);}}
   if(parameters.zip&&searchRadius(parameters.radius)!==-1){let nearby:Record<string,number>;try{nearby=zipRadius(parameters.zip,parameters.radius);}catch(error){return Response.json({error:error instanceof Error?error.message:'Enter a valid ZIP code.'},{status:400});}const distances=JSON.stringify(nearby);parts.push('substr(trim(zip),1,5) IN (SELECT key FROM json_each(?))');values.push(distances);standaloneParts.push('substr(trim(f.zip),1,5) IN (SELECT key FROM json_each(?))');standaloneValues.push(distances);}
   const grouped="SELECT min(company) AS name,"+firmColumn()+" AS firm_key,count(*) AS attorneys FROM attorneys WHERE trim(company)<>'' AND "+activeMembershipSQL()+" AND "+parts.join(' AND ')+' GROUP BY '+firmColumn()+" UNION ALL SELECT f.name,f.key,0 FROM firm_settings f WHERE "+standaloneParts.join(' AND ');values.push(...standaloneValues);
   if(suggest){const rows=await db.prepare(grouped+' ORDER BY name COLLATE NOCASE LIMIT 4').bind(...values).all();return Response.json({firms:rows.results});}
   const [rows,count]=await Promise.all([db.prepare(grouped+' ORDER BY name COLLATE NOCASE LIMIT '+DIRECTORY_PAGE_SIZE+' OFFSET ?').bind(...values,(page-1)*DIRECTORY_PAGE_SIZE).all<{name:string;firm_key:string}>(),db.prepare('SELECT count(*) AS total FROM ('+grouped+')').bind(...values).first<{total:number}>()]);
   if(record&&count?.total===1&&page===1&&parameters.eventId&&/^[0-9a-f-]{36}$/i.test(parameters.eventId)){
    const f=rows.results[0];if(request)await backgroundTask('Firm ranking update failed',async()=>{if(await allowRankedSearch(request,'firm:'+f.firm_key,parameters.eventId))await db.prepare('INSERT OR IGNORE INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').bind(parameters.eventId,f.firm_key,f.name,new Date().toISOString()).run();});
   }
   return Response.json({firms:rows.results,total:count?.total||0,page});
  }
  const clauses:string[]=[activeMembershipSQL()],args:string[]=[];
  const qualified=q.match(/^([a-z]{2}):[a-z0-9]{1,20}$/);if(qualified){clauses.push('state = ?');args.push(qualified[1].toUpperCase());}
  const practice=parameters.practice||typedArea?.id;
  if(practice){
   const area=catalog?.areas.find(a=>a.id===practiceCategoryId(practice));
   if(!area)return Response.json({error:'Unknown practice area.'},{status:400});
   const bars=Object.entries(practiceSources).filter(([,s])=>s.areas.includes(area.id)).map(([bar])=>bar);
   const assigned=[...(catalog?.bars.get(area.id)||[])];
   // Bound the outer lookup to known practice members before checking owner edits.
   // Keep one indexed membership lookup even when source and assigned lists overlap.
   clauses.push("bar_number IN (SELECT value FROM json_each(?)) AND (bar_number IN (SELECT value FROM json_each(?)) OR NOT (owner_edited=1 AND EXISTS(SELECT 1 FROM attorney_profiles ap WHERE ap.bar_number=attorneys.bar_number)))");
   args.push(JSON.stringify([...new Set([...bars,...assigned])]),JSON.stringify(assigned));
  }
  const escape=(s:string)=>s.replace(/[\\%_]/g,'\\$&');
  const location=city.match(/^(.+),\s*([a-z]{2})$/i),locationCity=location?location[1].trim():city,locationState=location?stateSearch(location[2]):'',queryState=stateSearch(q),cityState=stateSearch(city);
  // With a practice candidate list, a state index can scan tens of thousands
  // of rows. Unary + leaves the text filter intact but selects the ID index.
  const indexedName=indexReady?nameIndexFilter(q,parameters.kind!=='attorneys'):null;
  const candidateBound=!!practice||!!indexedName;
  const stateColumn=candidateBound?'+state':'state';
  if(locationState){clauses.push(stateColumn+' = ?');args.push(locationState);}
  if(queryState){clauses.push(stateColumn+' = ?');args.push(queryState);}
  if(cityState){clauses.push(stateColumn+' = ?');args.push(cityState);}
  const search=q&&!queryState?attorneyNameSearch(q,'','prefix',parameters.kind!=='attorneys'):null;
  if(search&&indexedName){const indexed=indexedName;if(indexed){search.where='('+indexed.where+' AND ('+search.where+'))';search.args=[...indexed.args,...search.args];}}
  if(search&&!id){
   const close=await closeNameCandidates(db,q).catch(error=>{
    console.error('Close name lookup failed',String(error),String(error?.cause||''));
    return [] as string[];
   });
   if(close.length){
    const originalWhere=search.where,originalArgs=[...search.args];
    search.where='('+originalWhere+' OR bar_number IN (SELECT value FROM json_each(?)))';
    search.args.push(JSON.stringify(close));
    search.order='CASE WHEN '+originalWhere+' THEN 0 ELSE 1 END, '+search.order;
    search.orderArgs=[...originalArgs,...search.orderArgs];
   }
  }
  const nameArgsStart=args.length;
  if(search){clauses.push(search.where);args.push(...search.args);}
  if(parameters.exactCity==='1'&&locationState){clauses.push((candidateBound?'+':'')+'lower(trim(city)) = ?');args.push(locationCity);}else if(city&&!cityState){clauses.push("lower(city) LIKE ? ESCAPE '\\'");args.push('%'+locationCity.split(/\s+/).map(escape).join('%')+'%');}
  const zip=(parameters.zip||'').trim();let nearbyOrder='',nearbyArgs:string[]=[];
  if(zip&&searchRadius(parameters.radius)!==-1){let nearby:Record<string,number>;try{nearby=zipRadius(zip,parameters.radius);}catch(error){return Response.json({error:error instanceof Error?error.message:'Enter a valid ZIP code.'},{status:400});}
   const distances=JSON.stringify(nearby);clauses.push((candidateBound?'+':'')+'substr(trim(zip),1,5) IN (SELECT key FROM json_each(?))');args.push(distances);
   nearbyOrder="json_extract(?, '$.\"' || substr(trim(zip),1,5) || '\"') ASC, ";nearbyArgs=[distances];
  }
  if(status){clauses.push('status = ?');args.push(status);}
  
  if(parameters.statusGroup==='not-active')clauses.push('0');
  const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
  if(suggest){
   const rows=await db.prepare('SELECT public_id,bar_number,'+publicLicenseColumn()+',name,company,employment_type,employer_name,employer_website,city,state FROM attorneys'+where+' ORDER BY '+nearbyOrder+(search?.order||'')+'name COLLATE NOCASE,bar_number LIMIT 6').bind(...args,...nearbyArgs,...(search?.orderArgs||[])).all();
   return Response.json({attorneys:rows.results});
  }
  const [rows,count]=await Promise.all([
   db.prepare('SELECT '+fields+' FROM attorneys'+where+' ORDER BY '+nearbyOrder+(search?.order||'')+'name COLLATE NOCASE,bar_number LIMIT '+DIRECTORY_PAGE_SIZE+' OFFSET ?').bind(...args,...nearbyArgs,...(search?.orderArgs||[]),(page-1)*DIRECTORY_PAGE_SIZE).all<{bar_number:string}>(),
   db.prepare('SELECT count(*) AS total FROM attorneys'+where).bind(...args).first<{total:number}>()
  ]);
  // Offer explicit alternatives after an empty name search; never count suggestions as matches or searches.
  let suggestions:unknown[]=[];
  const nameWords=q.split(/[\s.,;:()&/"-]+/).filter(Boolean);
  if(search&&!count?.total&&page===1&&!id&&nameWords.length>=2&&/^[\p{L}']{3,}$/u.test(nameWords[0])){
   const suggestionClauses=clauses.map(clause=>clause===search.where?"lower(name) LIKE ? ESCAPE '\\'":clause);
   const suggestionArgs=[...args.slice(0,nameArgsStart),escape(nameWords[0])+' %',...args.slice(nameArgsStart+search.args.length)];
   const suggested=await db.prepare('SELECT '+fields+' FROM attorneys WHERE '+suggestionClauses.join(' AND ')+' ORDER BY name COLLATE NOCASE,bar_number LIMIT 6').bind(...suggestionArgs).all();
   suggestions=suggested.results;
  }
  const eventId=parameters.eventId;
  if(record && q && eventId && /^[0-9a-f-]{36}$/i.test(eventId)) await backgroundTask('Attorney ranking update failed',async()=>{
   let bar=count?.total===1?rows.results[0]?.bar_number:undefined;
   if(id) {
    const match=await db.prepare('SELECT bar_number FROM attorneys'+where+' AND bar_number = ?').bind(...args,id).first<{bar_number:string}>();
    bar=match?.bar_number;
   }
   if(bar&&request&&await allowRankedSearch(request,'attorney:'+bar,eventId)) await db.prepare('INSERT OR IGNORE INTO attorney_search_events(event_id,bar_number,created_at) VALUES(?,?,?)').bind(eventId,bar,new Date().toISOString()).run();
  });
  if(id){const attorney=await db.prepare('SELECT '+publicAttorneyColumns()+' FROM attorneys WHERE '+activeMembershipSQL()+' AND bar_number = ?').bind(id).first();return Response.json({attorney},{status:attorney?200:404});}
  // Include firms in submitted name searches, even when their active roster is empty.
  // Do not record an extra ranked search just for displaying mixed results.
  let firms:unknown[]=[],firmTotal=0;
  if(parameters.kind!=='attorneys'&&firmKey(q)&&!practice&&!queryState){const response=await handle({...parameters,kind:'firms'},false);if(!response.ok)return response;const matches=await response.json() as {firms:unknown[];total:number};firms=matches.firms;firmTotal=matches.total;}
  const attorneyTotal=count?.total||0;
  return Response.json({attorneys:rows.results,firms,suggestions,total:attorneyTotal+firmTotal,paginationTotal:Math.max(attorneyTotal,firmTotal),page});
 } catch(error){console.error('Attorney search failed',String(error),String(error instanceof Error?error.cause||'':''));return Response.json({error:'Attorney records are temporarily unavailable. Please try again.'},{status:503});}
}
async function searchResponse(parameters:Record<string,string>,record=false,request?:Request){
 try{return await readDeadline((async()=>profileIdsResponse(await handle(parameters,record,request)))(),15000);}
 catch(error){console.error('Search response timed out',error instanceof Error?error.message:String(error));return Response.json({error:'Search is taking longer than expected. Please try again.'},{status:503,headers:{'Cache-Control':'private, no-store','Retry-After':'5'}});}
}
export async function GET(request:Request){const response=await searchResponse(Object.fromEntries(new URL(request.url).searchParams));response.headers.set('Cache-Control','no-store');return response;}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
 let input:Record<string,unknown>;
 try{const text=await request.text();if(text.length>16000)return Response.json({error:'Search request too large.'},{status:413});input=JSON.parse(text);}catch{return Response.json({error:'Invalid search request.'},{status:400});}
 if(!input||Array.isArray(input)||typeof input!=='object')return Response.json({error:'Invalid search request.'},{status:400});
 const parameters:Record<string,string>={};
 for(const key of ['q','city','status','page','id','home','eventId','firm','kind','statusGroup','practice','zip','radius','categories']){
  const value=input[key];if(value===undefined)continue;
  if(typeof value!=='string'&&!((key==='page'||key==='radius')&&typeof value==='number'&&Number.isFinite(value)))return Response.json({error:'Invalid search request.'},{status:400});
  parameters[key]=String(value).slice(0,2000);
 }
 const response=await searchResponse(parameters,true,request);response.headers.set('Cache-Control','private, no-store');return response;
}
