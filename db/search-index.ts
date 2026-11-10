import {publicReadCache} from './public-read-cache';
import {firmColumn} from '../app/api/attorneys/firm';
const readiness=new WeakMap<D1Database,()=>Promise<boolean>>();
export function searchIndexReady(db:D1Database){
 let read=readiness.get(db);if(!read){read=publicReadCache(async()=>!!(await db.prepare('SELECT ready FROM search_index_progress WHERE id=1').first<{ready:number}>())?.ready,15000);readiness.set(db,read);}return read();
}
// A trigram candidate filter is only a superset. Existing predicates still
// enforce word boundaries, license/state matching, ordering and eligibility.
const quote=(word:string)=>'"'+word.replaceAll('"','""')+'"';
export function indexedWord(query:string){return query.toLowerCase().split(/[\s.,;:()&/"-]+/).filter(w=>[...w].length>=3&&!w.includes('\0')).sort((a,b)=>b.length-a.length)[0];}
export function nameIndexFilter(query:string,includeCompany:boolean){
 const word=indexedWord(query);if(!word||/^lv[0-9a-f]{32}$/i.test(query))return null;
 const match=(includeCompany?'{name company}':'name')+' : '+quote(word);
 const lowered=query.toLowerCase(),license=lowered.startsWith('ga:lv')?lowered:lowered.replace(/^[a-z]{2}[:-]/,'');
 return {where:'rowid IN (SELECT rowid FROM attorney_search_fts WHERE attorney_search_fts MATCH ? UNION SELECT rowid FROM attorneys WHERE lower(COALESCE(license_number,bar_number))=?)',args:[match,license]};
}
export function firmIndexFilter(query:string,key:string,standalone=false){
 const word=indexedWord(query);if(!word||[...key].length<3||key.includes('\0'))return null;
 const table=standalone?'firm_search_fts':'attorney_search_fts';
 return {where:(standalone?'f.rowid':'rowid')+` IN (SELECT rowid FROM ${table} WHERE ${table} MATCH ?)`,args:['firm_key : '+quote(key)+' OR '+(standalone?'name':'company')+' : '+quote(word)]};
}
// Resumable, transactionally bounded maintenance. Cursors and documents commit
// together, so retries are safe and live edits cannot be overwritten by old data.
export async function buildSearchIndexBatch(db:D1Database){
 await db.prepare('INSERT OR IGNORE INTO search_index_progress(id) VALUES(1)').run();
 const statements=[
  `INSERT OR REPLACE INTO attorney_search_fts(rowid,name,company,firm_key) SELECT a.rowid,CASE WHEN a.bar_number='231458' THEN a.name||' Ted Tedd S' WHEN a.bar_number='004170' THEN a.name||' Randy' ELSE a.name END,a.company||' '||a.employer_name||' '||a.employment_type,${firmColumn('a.company')} FROM attorneys a WHERE a.rowid>(SELECT attorney_cursor FROM search_index_progress WHERE id=1) ORDER BY a.rowid LIMIT 500`,
  'UPDATE search_index_progress SET attorney_cursor=coalesce((SELECT max(rowid) FROM (SELECT rowid FROM attorneys WHERE rowid>attorney_cursor ORDER BY rowid LIMIT 500)),attorney_cursor) WHERE id=1',
  'INSERT OR REPLACE INTO firm_search_fts(rowid,name,firm_key) SELECT rowid,name,key FROM firm_settings WHERE rowid>(SELECT firm_cursor FROM search_index_progress WHERE id=1) ORDER BY rowid LIMIT 500',
  'UPDATE search_index_progress SET firm_cursor=coalesce((SELECT max(rowid) FROM (SELECT rowid FROM firm_settings WHERE rowid>firm_cursor ORDER BY rowid LIMIT 500)),firm_cursor) WHERE id=1',
  'UPDATE search_index_progress SET ready=CASE WHEN NOT EXISTS(SELECT 1 FROM attorneys WHERE rowid>attorney_cursor) AND NOT EXISTS(SELECT 1 FROM firm_settings WHERE rowid>firm_cursor) THEN 1 ELSE 0 END WHERE id=1',
 ];
 await db.batch(statements.map(sql=>db.prepare(sql)));
 return db.prepare('SELECT attorney_cursor,firm_cursor,ready FROM search_index_progress WHERE id=1').first();
}
