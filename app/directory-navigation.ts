import {searchRadius} from './search-radius';
export type DirectoryQuery={q:string;city:string;zip?:string;radius?:number;practice:string;statusGroup:string;kind:string;page:number;eventId:string};
export function directoryLocation(search:string,eventId=''){
 const p=new URLSearchParams(search),view:'charts'|'shortlist'|'discover'=p.get('view')==='charts'?'charts':p.get('view')==='shortlist'?'shortlist':'discover';
 const query:DirectoryQuery={q:p.get('q')||'',city:p.get('city')||'',...(p.get('zip')?{zip:p.get('zip')!.trim(),radius:searchRadius(p.get('radius'))}:{}),practice:p.get('practice')||'',statusGroup:['active','not-active'].includes(p.get('status')||'')?p.get('status')!:'all',kind:p.get('kind')==='firms'?'firms':'attorneys',page:Math.max(1,Math.min(10000,Number.parseInt(p.get('page')||'1')||1)),eventId};
 return {view,query,searched:['q','city','zip','practice','kind'].some(key=>p.has(key))};
}
export function directorySearchPath(view:string,query:DirectoryQuery,basePath='/'){const p=new URLSearchParams();if(view!=='discover')p.set('view',view);for(const key of ['q','city','zip','practice'] as const)if(query[key])p.set(key,query[key]);if(query.zip)p.set('radius',String(searchRadius(query.radius)));if(query.kind==='firms')p.set('kind','firms');if(query.statusGroup!=='all')p.set('status',query.statusGroup);if(query.page>1)p.set('page',String(query.page));return basePath+(p.size?'?'+p:'');}
