import {photoRevision} from '../app/attorney-photo';
import {rawDb} from './raw';
import {ensurePublicProfileIds} from './public-profile-ids';
import {isPublicReference} from './attorney-reference';
import {verifiedFirmForAttorney} from '../app/verified-firm-rosters';
import {practiceSources,practiceAreas} from '../app/practice-areas';
import {attorneyBiographyWebsites,firmWebsites,websitesByFirm,linkedInByFirm,attorneyLinkedIn,confirmedFirmWebsite} from '../app/firm-websites';
import {publishedAttorneyDetails} from '../app/published-attorney-details';
import {firmKey} from '../app/api/attorneys/firm';
const defaultPhotos:Record<string,string>={'238455':'/attorneys/brennan-john-mcelhone.png','356082':'/attorneys/matthew-c-hines.png'};
export async function publicRecords<T>(value:T):Promise<T>{
 const data=structuredClone(value),rows:Record<string,unknown>[]=[];
 function collect(v:unknown){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(collect);return;}const row=v as Record<string,unknown>;delete row.source_id;delete row.license_number;if(Array.isArray(row.bars))delete row.bars;if(typeof row.bar_number==='string'&&!isPublicReference(row.bar_number))rows.push(row);Object.values(row).forEach(collect);}
 collect(data);const firm=(data as {firm?:{name?:string;website?:string;linkedinUrl?:string}}|null)?.firm;if(firm?.name){const key=firmKey(firm.name);firm.website=confirmedFirmWebsite(key,firm.website?.trim()||websitesByFirm[key]);firm.linkedinUrl=firm.linkedinUrl??linkedInByFirm[key];}if(!rows.length)return data;
 // Most directory queries already selected the authoritative public ID. Reuse
 // it instead of adding another database dependency after a successful search.
 const map=new Map<string,string>();
 for(const row of rows)if(typeof row.public_id==='string'&&/^[a-f0-9]{32}$/.test(row.public_id))map.set(row.bar_number as string,row.public_id);
 const ids=[...new Set(rows.map(r=>r.bar_number as string))].filter(id=>!map.has(id));
 const db=ids.length?rawDb():undefined;
 for(let i=0;i<ids.length;i+=250){const {results}=await db!.prepare('SELECT bar_number,name,public_id FROM attorneys WHERE bar_number IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids.slice(i,i+250))).all<{bar_number:string;name:string;public_id:string}>();await ensurePublicProfileIds(results);for(const row of results)map.set(row.bar_number,row.public_id);}
 for(const row of rows){const bar=row.bar_number as string,id=map.get(bar);if(!id)throw Error('Public profile identity unavailable');
  if(typeof row.name==='string'&&typeof row.company==='string'){
   if(!row.owner_edited&&(!row.employment_type||row.employment_type==='Law Firm Attorney'))row.company=verifiedFirmForAttorney(bar)?.name||row.company;
   const key=firmKey(row.company as string);
   row.biography_website=attorneyBiographyWebsites[bar]||'';
   row.firm_website=confirmedFirmWebsite(key,row.owner_edited?'':firmWebsites[bar]||websitesByFirm[key]);
   row.attorney_linkedin=attorneyLinkedIn[bar]||'';row.firm_linkedin=linkedInByFirm[key]||'';
   row.published_details=publishedAttorneyDetails(row as {bar_number:string;name:string;state?:string});
   if(row.practice_areas==null&&!row.owner_edited)row.practice_areas=(practiceSources[bar]?.areas||[]).map(id=>practiceAreas.find(p=>p.id===id)?.name||id).join(', ');
   if(!row.photo_key&&defaultPhotos[bar])row.photo_key='public';
  }
  if(row.photo_key)row.photo_key=photoRevision(String(row.photo_key));if(row.attorney_photo_key)row.attorney_photo_key=photoRevision(String(row.attorney_photo_key));
  if(typeof row.id==='string'){try{const pair=JSON.parse(row.id);if(Array.isArray(pair)&&pair.length===2&&pair[1]===bar)row.id=JSON.stringify([pair[0],'LV'+id]);}catch{}}
  delete row.source_id;delete row.license_number;row.public_id=id;row.bar_number='LV'+id;
 }
 return data;
}
export async function profileIdsResponse(response:Response){if(!response.ok)return response;try{return Response.json(await publicRecords(await response.json()),{status:response.status,headers:response.headers});}catch{return Response.json({error:'Attorney records are temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export {defaultPhotos};
