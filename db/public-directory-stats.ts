import {publicReadCache} from './public-read-cache';
import {activeMembershipSQL} from './active-membership';
const readers=new WeakMap<D1Database,()=>Promise<{total:number;updated:string}|null>>();
export function publicDirectoryStats(db:D1Database){
 let read=readers.get(db);
 if(!read){read=publicReadCache(()=>db.prepare('SELECT count(*) AS total,max(imported_at) AS updated FROM attorneys WHERE '+activeMembershipSQL()).first<{total:number;updated:string}>(),300000);readers.set(db,read);}
 return read();
}
