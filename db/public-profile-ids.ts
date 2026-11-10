import {rawDb} from './raw';
// Allocate IDs only for records being read. Bounded batches avoid a table-wide
// migration backfill and concurrent readers reuse the winning persisted ID.
export async function ensurePublicProfileIds<T>(data:T):Promise<T>{
 const missing:Record<string,unknown>[]=[];
 function visit(value:unknown){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}const row=value as Record<string,unknown>;if(typeof row.bar_number==='string'&&typeof row.name==='string'&&!row.public_id)missing.push(row);for(const child of Object.values(row))if(child&&typeof child==='object')visit(child);}
 visit(data);if(!missing.length)return data;
 const ids=[...new Set(missing.map(row=>row.bar_number as string))],db=rawDb(),found=new Map<string,string>();
 for(let i=0;i<ids.length;i+=250){const chunk=JSON.stringify(ids.slice(i,i+250));await db.prepare('UPDATE attorneys SET public_id=lower(hex(randomblob(16))) WHERE public_id IS NULL AND bar_number IN (SELECT value FROM json_each(?))').bind(chunk).run();const {results}=await db.prepare('SELECT bar_number,public_id FROM attorneys WHERE bar_number IN (SELECT value FROM json_each(?))').bind(chunk).all<{bar_number:string;public_id:string}>();for(const row of results)found.set(row.bar_number,row.public_id);}
 for(const row of missing){const id=found.get(row.bar_number as string);if(id)row.public_id=id;}
 return data;
}
