import {firmColumn} from './firm';
export function monthStart(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric'}).formatToParts(now);
 const year=Number(parts.find(p=>p.type==='year')?.value),month=Number(parts.find(p=>p.type==='month')?.value)-1;
 const noon=new Date(Date.UTC(year,month,1,12));
 const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(noon).find(p=>p.type==='timeZoneName')?.value||'GMT-5';
 const offset=Number(zone.replace('GMT',''));
 return new Date(Date.UTC(year,month,1)-offset*3600000).toISOString();
}
export const attorneyChartSQL=`WITH counts AS (
 SELECT a.*,(SELECT photo_key FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS photo_key,(SELECT practice_areas FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS practice_areas,count(*) AS searches FROM attorney_search_events e JOIN attorneys a ON a.bar_number=e.bar_number
 WHERE e.created_at >= ? AND e.created_at <= ? AND a.status='Active Member in Good Standing'
 GROUP BY a.bar_number
) SELECT *,rank() OVER (ORDER BY searches DESC) AS rank FROM counts ORDER BY searches DESC,name COLLATE NOCASE,bar_number LIMIT 100`;
export const firmChartSQL=`WITH activity AS (
 SELECT e.event_id,${firmColumn()} AS firm_key,a.company AS name FROM attorney_search_events e JOIN attorneys a ON a.bar_number=e.bar_number WHERE e.created_at>=? AND e.created_at<=? AND trim(a.company)<>''
 UNION ALL SELECT event_id,firm_key,firm_name AS name FROM firm_search_events WHERE created_at>=? AND created_at<=?
), counts AS (
 SELECT firm_key,min(name) AS name,count(DISTINCT event_id) AS searches FROM activity WHERE firm_key<>'' GROUP BY firm_key
) SELECT *,rank() OVER (ORDER BY searches DESC) AS rank FROM counts ORDER BY searches DESC,name COLLATE NOCASE LIMIT 100`;
export async function discoveryData(db:D1Database,includeCounts=false){
 const now=new Date(),end=now.toISOString(),week=new Date(now.getTime()-7*86400000).toISOString(),month=monthStart(now);
 const [weekly,monthly,weeklyFirms,monthlyFirms,statuses,cities]=await Promise.all([
  db.prepare(attorneyChartSQL).bind(week,end).all(),db.prepare(attorneyChartSQL).bind(month,end).all(),
  db.prepare(firmChartSQL).bind(week,end,week,end).all(),db.prepare(firmChartSQL).bind(month,end,month,end).all(),
  db.prepare('SELECT DISTINCT status FROM attorneys ORDER BY status').all<{status:string}>(),
  db.prepare("SELECT city,count(*) AS attorneys FROM attorneys WHERE status='Active Member in Good Standing' AND trim(city)<>'' GROUP BY city COLLATE NOCASE ORDER BY attorneys DESC,city LIMIT 8").all()
 ]);
 const visible=(rows:Record<string,unknown>[])=>includeCounts?rows:rows.map(({searches,...row})=>row);
 return {weekly:visible(weekly.results),monthly:visible(monthly.results),weeklyFirms:visible(weeklyFirms.results),monthlyFirms:visible(monthlyFirms.results),statuses:statuses.results.map(x=>x.status),cities:cities.results,monthLabel:new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'long',year:'numeric'}).format(now),updated:end};
}
