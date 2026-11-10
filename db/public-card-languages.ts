import {readDeadline} from '../app/read-json';
import {publicReadCache} from './public-read-cache';
import type {Attorney} from '../app/GeorgiaDirectory';
import type {DiscoveryData} from '../app/Discovery';
// Ranking snapshots may outlive profile edits. Refresh only the small public
// language, practice and ownership fields, without rerunning rankings or fetching individual profiles.
const readers=new WeakMap<D1Database,{key:string;read:()=>Promise<Map<string,{languages:string;practice_areas:string|null;ownership_verified:number}>>}>();
export async function refreshCardLanguages(db:D1Database,data:DiscoveryData):Promise<DiscoveryData>{
 const groups=['popular','weekly','monthly','ratedAll','ratedWeekly','ratedMonthly'] as const;
 const id=(row:{public_id?:string|null;bar_number:string})=>row.public_id||row.bar_number.replace(/^LV/,'');
 const ids=[...new Set(groups.flatMap(group=>(data[group]||[]).map(id)))].sort(),key=JSON.stringify(ids);
 if(!ids.length)return data;
 let reader=readers.get(db);
 if(!reader||reader.key!==key){
  const read=publicReadCache(async()=>{
   const {results}=await readDeadline(db.prepare("SELECT a.public_id,coalesce(p.languages,'') AS languages,p.practice_areas,EXISTS(SELECT 1 FROM attorney_profiles verified WHERE verified.bar_number=a.bar_number AND verified.owner_id<>'' AND verified.claimed_at<>'') AS ownership_verified FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE a.public_id IN (SELECT value FROM json_each(?))").bind(key).all<{public_id:string;languages:string;practice_areas:string|null;ownership_verified:number}>(),1500);
   return new Map(results.map(row=>[row.public_id,{languages:row.languages,practice_areas:row.practice_areas,ownership_verified:row.ownership_verified}]));
  },60000);
  reader={key,read};readers.set(db,reader);
 }
 try{
  const fields=await reader.read();
  const update=<T extends Attorney>(rows:T[]|undefined)=>rows?.map(row=>{const current=fields.get(id(row));return current?{...row,languages:current.languages,practice_areas:current.practice_areas??row.practice_areas,ownership_verified:current.ownership_verified??row.ownership_verified}:row;});
  return {...data,popular:update(data.popular),weekly:update(data.weekly)!,monthly:update(data.monthly)!,ratedAll:update(data.ratedAll),ratedWeekly:update(data.ratedWeekly),ratedMonthly:update(data.ratedMonthly)};
 }catch(error){console.warn('Public card field refresh unavailable',error instanceof Error?error.message:String(error));return data;}
}
