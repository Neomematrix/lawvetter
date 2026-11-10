import {publicReadCache} from './public-read-cache';
import {categoryList,practiceCategoryId,splitPracticeAreas} from '../app/practice-category';
async function loadPracticeCatalog(db:D1Database){const {results}=await db.prepare("SELECT p.bar_number,p.practice_areas FROM attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number WHERE trim(p.practice_areas)<>''").all<{bar_number:string;practice_areas:string}>();const areas=categoryList(results.map(row=>row.practice_areas)),bars=new Map<string,Set<string>>();for(const row of results)for(const name of splitPracticeAreas(row.practice_areas)){const id=practiceCategoryId(name);if(!bars.has(id))bars.set(id,new Set());bars.get(id)!.add(row.bar_number);}return {areas,bars};}

// Public requests are read-only: historical data migrations must not run here.
// Share the public category roster across searches; edits become visible within one minute.
const readers=new WeakMap<D1Database,()=>ReturnType<typeof loadPracticeCatalog>>();
export function practiceCatalog(db:D1Database){
 let read=readers.get(db);
 if(!read){read=publicReadCache(()=>loadPracticeCatalog(db),60000,5000);readers.set(db,read);}
 return read();
}
