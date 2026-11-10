import {easternAnalyticsBuckets,easternAnalyticsDay} from './search-analytics-time';
export function searchEngine(referrer:string):'google'|'bing'|null{
 try{const u=new URL(referrer);if(!['http:','https:'].includes(u.protocol))return null;const h=u.hostname.toLowerCase();if(h==='bing.com'||h.endsWith('.bing.com'))return 'bing';if(/^(?:[a-z0-9-]+\.)?google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(h))return 'google';}catch{}return null;
}
export function referralBar(landing:string){try{
 const u=new URL(landing,'https://lawvetter.com');
 if(u.pathname==='/attorney'){const bar=u.searchParams.get('bar')||'';return /^(?:(?:[A-Z]{2}:)?\d{1,20}|[A-Z]{2}:LV[0-9a-f]{1,64}|LV[0-9a-f]{32})$/.test(bar)?bar:'';}
 const path=decodeURIComponent(u.pathname),publicId=path.match(/^\/lawyers\/[^/]+-lv-([0-9a-f]{32})$/)?.[1];
 return publicId?'LV'+publicId:path.match(/^\/lawyers\/((?:(?:[A-Z]{2}:)?\d{1,20}|[A-Z]{2}:LV[0-9a-f]{1,64}))(?:-|$)/)?.[1]||'';
}catch{return '';}}
// Tables are now migration-owned. Retain the helper for existing call sites.
export async function ensureReferrals(_db:D1Database){}

export type ReferralAttorney={bar_number:string;name:string;photo_key?:string|null;google:number;bing:number};
export type AnalyticsPeriod={internalTotal:number;google:number;bing:number;attorneys:ReferralAttorney[];trend:{day:string;internal:number;google:number;bing:number;inProgress:boolean}[]};
export async function searchAnalyticsPeriod(db:D1Database,start:string,end:string):Promise<AnalyticsPeriod>{
 const buckets=easternAnalyticsBuckets(start,end),today=easternAnalyticsDay(end);
 const daySQL=`WITH days(day,starts,ends) AS (VALUES ${buckets.map(()=>'(?,?,?)').join(',')})`;
 const dayBindings=buckets.flatMap(row=>[row.day,row.start,row.end]);
 const [totals,internal,attorneys,referralTrend,internalTrend]=await Promise.all([
 db.prepare(`SELECT COALESCE(SUM(source='google'),0) AS google,COALESCE(SUM(source='bing'),0) AS bing FROM search_referral_visits WHERE created_at>=? AND created_at<=?`).bind(start,end).first<{google:number;bing:number}>(),
 db.prepare('SELECT COUNT(*) AS total FROM attorney_search_events WHERE created_at>=? AND created_at<=?').bind(start,end).first<{total:number}>(),
 db.prepare(`SELECT a.bar_number,a.name,p.photo_key,SUM(v.source='google') AS google,SUM(v.source='bing') AS bing FROM search_referral_visits v JOIN attorneys a ON a.bar_number=v.bar_number LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE v.created_at>=? AND v.created_at<=? GROUP BY a.bar_number ORDER BY COUNT(*) DESC,a.name COLLATE NOCASE LIMIT 50`).bind(start,end).all<ReferralAttorney>(),
 db.prepare(`${daySQL} SELECT d.day,COALESCE(SUM(v.source='google'),0) AS google,COALESCE(SUM(v.source='bing'),0) AS bing FROM days d LEFT JOIN search_referral_visits v ON v.created_at>=d.starts AND v.created_at<d.ends AND v.created_at>=? AND v.created_at<=? GROUP BY d.day ORDER BY d.day`).bind(...dayBindings,start,end).all<{day:string;google:number;bing:number}>(),
 db.prepare(`${daySQL} SELECT d.day,COUNT(v.created_at) AS internal FROM days d LEFT JOIN attorney_search_events v ON v.created_at>=d.starts AND v.created_at<d.ends AND v.created_at>=? AND v.created_at<=? GROUP BY d.day ORDER BY d.day`).bind(...dayBindings,start,end).all<{day:string;internal:number}>()
 ]);
 const days=new Map(buckets.map(({day})=>[day,{day,internal:0,google:0,bing:0,inProgress:day===today}]));for(const row of referralTrend.results)Object.assign(days.get(row.day)!,row);for(const row of internalTrend.results)Object.assign(days.get(row.day)!,row);
 return {internalTotal:internal?.total||0,google:totals?.google||0,bing:totals?.bing||0,attorneys:attorneys.results,trend:[...days.values()]};
}
