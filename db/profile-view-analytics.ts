import {easternAnalyticsBuckets,easternAnalyticsDay} from './search-analytics-time';
import {firmColumn} from '../app/api/attorneys/firm';
export type ProfileViewRow={target:string;name:string;views:number;photo_key?:string|null};
export type ProfileViewAnalytics={total:number;attorneyTotal:number;firmTotal:number;attorneys:ProfileViewRow[];firms:ProfileViewRow[];trend:{day:string;views:number;inProgress:boolean}[]};
export async function profileViewAnalytics(db:D1Database,start:string,end:string):Promise<ProfileViewAnalytics>{
 const buckets=easternAnalyticsBuckets(start,end),today=easternAnalyticsDay(end);
 const [totals,attorneys,firms,trend]=await Promise.all([
 db.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(target_kind='attorney'),0) AS attorneyTotal,COALESCE(SUM(target_kind='firm'),0) AS firmTotal FROM directory_page_views WHERE created_at>=? AND created_at<=?").bind(start,end).first<{total:number;attorneyTotal:number;firmTotal:number}>(),
 db.prepare("SELECT v.target_key AS target,a.name,p.photo_key,COUNT(*) AS views FROM directory_page_views v JOIN attorneys a ON a.bar_number=v.target_key LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE v.target_kind='attorney' AND v.created_at>=? AND v.created_at<=? GROUP BY v.target_key ORDER BY views DESC,a.name COLLATE NOCASE LIMIT 50").bind(start,end).all<ProfileViewRow>(),
 db.prepare(`WITH ranked AS (SELECT target_key,COUNT(*) AS views FROM directory_page_views WHERE target_kind='firm' AND created_at>=? AND created_at<=? GROUP BY target_key ORDER BY views DESC,target_key LIMIT 50) SELECT r.target_key AS target,COALESCE(NULLIF(f.name,''),(SELECT a.company FROM attorneys a WHERE ${firmColumn('a.company')}=+r.target_key LIMIT 1),r.target_key) AS name,r.views FROM ranked r LEFT JOIN firm_settings f ON f.key=r.target_key ORDER BY r.views DESC,name COLLATE NOCASE`).bind(start,end).all<ProfileViewRow>(),
 db.prepare(`WITH days(day,starts,ends) AS (VALUES ${buckets.map(()=>'(?,?,?)').join(',')}) SELECT d.day,COUNT(v.event_id) AS views FROM days d LEFT JOIN directory_page_views v ON v.created_at>=d.starts AND v.created_at<d.ends AND v.created_at>=? AND v.created_at<=? GROUP BY d.day ORDER BY d.day`).bind(...buckets.flatMap(b=>[b.day,b.start,b.end]),start,end).all<{day:string;views:number}>()
 ]);
 return {...(totals||{total:0,attorneyTotal:0,firmTotal:0}),attorneys:attorneys.results,firms:firms.results,trend:trend.results.map(row=>({...row,inProgress:row.day===today}))};
}
