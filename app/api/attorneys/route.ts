import {practiceAreas,practiceSources} from '../../practice-areas';
import {discoveryData} from './charts';
import { rawDb } from '../../../db/raw';
import { firmKey, firmColumn } from './firm';
import { attorneyNameSearch } from './search';
const fields = 'bar_number,name,company,city,county,status,admit_date,imported_at,(SELECT photo_key FROM attorney_profiles p WHERE p.bar_number=attorneys.bar_number) AS photo_key';
async function handle(parameters: Record<string, string>, record = false) {
 try {
  const db = rawDb(), id = parameters.id;
  if (parameters.firm !== undefined) {
   const key=firmKey(parameters.firm.slice(0,500));
   if(!key)return Response.json({error:'Enter a firm name.'},{status:400});
   const page=Math.max(1,Math.min(10000,Number.parseInt(parameters.page||'1')||1));
   const where=firmColumn()+' = ?';
   const [rows,summary,locations]=await Promise.all([
    db.prepare('SELECT '+fields+' FROM attorneys WHERE '+where+' ORDER BY name COLLATE NOCASE,bar_number LIMIT 25 OFFSET ?').bind(key,(page-1)*25).all(),
    db.prepare("SELECT count(*) AS total,sum(CASE WHEN status='Active Member in Good Standing' THEN 1 ELSE 0 END) AS active,max(imported_at) AS updated,min(company) AS name FROM attorneys WHERE "+where).bind(key).first<{total:number;active:number;updated:string;name:string}>(),
    db.prepare("SELECT DISTINCT city FROM attorneys WHERE "+where+" AND city <> '' ORDER BY city COLLATE NOCASE").bind(key).all<{city:string}>()
   ]);
   if(!summary?.total)return Response.json({error:'No firm records were found. Check the firm name and try again.'},{status:404});
   if(record && parameters.eventId && /^[0-9a-f-]{36}$/i.test(parameters.eventId))await db.prepare('INSERT OR IGNORE INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').bind(parameters.eventId,key,summary.name,new Date().toISOString()).run();
   return Response.json({firm:{name:summary.name,total:summary.total,active:summary.active,updated:summary.updated,cities:locations.results.map(r=>r.city)},attorneys:rows.results,page});
  }
  if(parameters.home==='1')return Response.json(await discoveryData(db));
  if(id && !record) {
   const attorney=await db.prepare('SELECT * FROM attorneys WHERE bar_number = ?').bind(id).first();
   return Response.json({attorney},{status:attorney?200:404});
  }
  const q=(parameters.q||'').trim().slice(0,150).toLowerCase(), city=(parameters.city||'').trim().slice(0,100).toLowerCase(), status=(parameters.status||'').trim().slice(0,100);
  const page=Math.min(10000,Math.max(1,Number.parseInt(parameters.page||'1')||1));
  if(parameters.kind==='firms'){
   const key=firmKey(q),parts:string[]=[],values:string[]=[];
   if(key){parts.push(firmColumn()+" LIKE ? ESCAPE '\\'");values.push('%'+key.replace(/[\\%_]/g,'\\$&')+'%');}
   if(city){parts.push('lower(city)=?');values.push(city);}
   if(!parts.length)return Response.json({error:'Enter a firm name or city.'},{status:400});
   const grouped="SELECT min(company) AS name,"+firmColumn()+" AS firm_key,count(*) AS attorneys FROM attorneys WHERE trim(company)<>'' AND "+parts.join(' AND ')+' GROUP BY '+firmColumn();
   const [rows,count]=await Promise.all([db.prepare(grouped+' ORDER BY name COLLATE NOCASE LIMIT 25 OFFSET ?').bind(...values,(page-1)*25).all<{name:string;firm_key:string}>(),db.prepare('SELECT count(*) AS total FROM ('+grouped+')').bind(...values).first<{total:number}>()]);
   if(record&&count?.total===1&&page===1&&parameters.eventId&&/^[0-9a-f-]{36}$/i.test(parameters.eventId)){
    const f=rows.results[0];await db.prepare('INSERT OR IGNORE INTO firm_search_events(event_id,firm_key,firm_name,created_at) VALUES(?,?,?,?)').bind(parameters.eventId,f.firm_key,f.name,new Date().toISOString()).run();
   }
   return Response.json({firms:rows.results,total:count?.total||0,page});
  }
  const clauses:string[]=[],args:string[]=[];
  if(parameters.practice){
   const area=practiceAreas.find(a=>a.id===parameters.practice);
   if(!area)return Response.json({error:'Unknown practice area.'},{status:400});
   const bars=Object.entries(practiceSources).filter(([,s])=>s.areas.includes(area.id)).map(([bar])=>bar);
   clauses.push("(bar_number IN (SELECT value FROM json_each(?)) OR bar_number IN (SELECT bar_number FROM attorney_profiles WHERE instr(',' || replace(lower(trim(practice_areas)), ', ', ',') || ',', ?) > 0))");
   args.push(JSON.stringify(bars),','+area.name.toLowerCase()+',');
  }
  const escape=(s:string)=>s.replace(/[\\%_]/g,'\\$&');
  const search=q?attorneyNameSearch(q):null;
  if(search){clauses.push(search.where);args.push(...search.args);}
  if(city){clauses.push("lower(city) LIKE ? ESCAPE '\\'");args.push('%'+city.split(/\s+/).map(escape).join('%')+'%');}
  if(status){clauses.push('status = ?');args.push(status);}
  if(parameters.statusGroup==='active')clauses.push("status = 'Active Member in Good Standing'");
  if(parameters.statusGroup==='not-active')clauses.push("status <> 'Active Member in Good Standing'");
  const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
  const [rows,count,all]=await Promise.all([
   db.prepare('SELECT '+fields+' FROM attorneys'+where+' ORDER BY '+(search?.order||'')+'name COLLATE NOCASE,bar_number LIMIT 25 OFFSET ?').bind(...args,...(search?.orderArgs||[]),(page-1)*25).all<{bar_number:string}>(),
   db.prepare('SELECT count(*) AS total FROM attorneys'+where).bind(...args).first<{total:number}>(),
   db.prepare('SELECT count(*) AS total,max(imported_at) AS updated FROM attorneys').first<{total:number,updated:string}>()
  ]);
  const eventId=parameters.eventId;
  if(record && q && eventId && /^[0-9a-f-]{36}$/i.test(eventId)) {
   let bar=count?.total===1?rows.results[0]?.bar_number:undefined;
   if(id) {
    const match=await db.prepare('SELECT bar_number FROM attorneys'+where+' AND bar_number = ?').bind(...args,id).first<{bar_number:string}>();
    bar=match?.bar_number;
   }
   if(bar) await db.prepare('INSERT OR IGNORE INTO attorney_search_events(event_id,bar_number,created_at) VALUES(?,?,?)').bind(eventId,bar,new Date().toISOString()).run();
  }
  if(id){const attorney=await db.prepare('SELECT * FROM attorneys WHERE bar_number = ?').bind(id).first();return Response.json({attorney},{status:attorney?200:404});}
  return Response.json({attorneys:rows.results,total:count?.total||0,page,totalImported:all?.total||0,updated:all?.updated});
 } catch(error){console.error('Attorney search failed',error);return Response.json({error:'Attorney records are temporarily unavailable. Please try again.'},{status:503});}
}
export async function GET(request:Request){return handle(Object.fromEntries(new URL(request.url).searchParams));}
export async function POST(request:Request){
 let input:Record<string,unknown>;
 try{input=await request.json();}catch{return Response.json({error:'Invalid search request.'},{status:400});}
 if(!input||Array.isArray(input)||typeof input!=='object')return Response.json({error:'Invalid search request.'},{status:400});
 const parameters:Record<string,string>={};
 for(const key of ['q','city','status','page','id','home','eventId','firm','kind','statusGroup','practice']){
  const value=input[key];if(value===undefined)continue;
  if(typeof value!=='string'&&!(key==='page'&&typeof value==='number'&&Number.isFinite(value)))return Response.json({error:'Invalid search request.'},{status:400});
  parameters[key]=String(value).slice(0,2000);
 }
 const response=await handle(parameters,true);response.headers.set('Cache-Control','private, no-store');return response;
}
