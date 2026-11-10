import {attorneyRankingActivitySQL,firmRankingActivitySQL} from '../../../db/ranking-activity';
import {readDeadline} from '../../read-json';
import {currentMonth,monthBoundary} from '../../awards/core';
import {finalizeClosedAwards} from '../../../db/monthly-awards';
import {publicAttorneyColumns} from '../../../db/public-attorney';
import {publicReadCache} from '../../../db/public-read-cache';
import {ownershipVerifiedColumn} from '../../../db/attorney-verification';
import {practiceCatalog} from '../../../db/practice-categories';
import {firmColumn} from './firm';
export function monthStart(now=new Date()){return monthBoundary(currentMonth(now));}
export const attorneyChartSQL=`WITH counts AS (
 SELECT ${publicAttorneyColumns('a')},${ownershipVerifiedColumn('a')},(SELECT languages FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS languages,(SELECT photo_key FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS photo_key,(SELECT practice_areas FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS practice_areas,count(*) AS searches FROM (${attorneyRankingActivitySQL}) e JOIN attorneys a ON a.bar_number=e.bar_number
 WHERE e.created_at >= ? AND e.created_at <= ? AND lower(trim(a.status)) IN ('active','active member in good standing','member in good standing')
 GROUP BY a.bar_number
) SELECT *,row_number() OVER (ORDER BY searches DESC,name COLLATE NOCASE,bar_number) AS rank FROM counts ORDER BY searches DESC,name COLLATE NOCASE,bar_number LIMIT 50`;
export const ratedAttorneyChartSQL=`WITH ratings AS (
 SELECT ${publicAttorneyColumns('a')},${ownershipVerifiedColumn('a')},(SELECT languages FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS languages,(SELECT photo_key FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS photo_key,(SELECT practice_areas FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS practice_areas,
 AVG((v.rating_use_again+v.rating_cared_for+v.rating_rights+v.rating_outcome)/4.0) AS review_average,COUNT(*) AS review_count
 FROM client_verifications v JOIN attorneys a ON a.bar_number=v.bar_number
 WHERE v.status='approved' AND v.published_at IS NOT NULL AND v.review_body<>'' AND v.published_at>=? AND v.published_at<=? AND lower(trim(a.status)) IN ('active','active member in good standing','member in good standing')
 AND v.rating_use_again BETWEEN 1 AND 5 AND v.rating_cared_for BETWEEN 1 AND 5 AND v.rating_rights BETWEEN 1 AND 5 AND v.rating_outcome BETWEEN 1 AND 5
 GROUP BY a.bar_number
) SELECT *,row_number() OVER(ORDER BY review_average DESC,review_count DESC,name COLLATE NOCASE,bar_number) AS rank FROM ratings ORDER BY review_average DESC,review_count DESC,name COLLATE NOCASE,bar_number LIMIT 100`;
export const firmChartSQL=`WITH activity AS (
 SELECT e.event_id,${firmColumn()} AS firm_key,a.company AS name FROM (${attorneyRankingActivitySQL}) e JOIN attorneys a ON a.bar_number=e.bar_number WHERE e.created_at>=? AND e.created_at<=? AND trim(a.company)<>''
 UNION ALL SELECT event_id,firm_key,firm_name AS name FROM (${firmRankingActivitySQL}) firm_search_events WHERE created_at>=? AND created_at<=? AND (EXISTS(SELECT 1 FROM attorneys current WHERE ${firmColumn('current.company')}=+firm_search_events.firm_key) OR EXISTS(SELECT 1 FROM firm_settings fs WHERE fs.key=firm_search_events.firm_key AND fs.organization_type='Law Firm'))
), counts AS (
 SELECT firm_key,min(name) AS name,count(DISTINCT event_id) AS searches FROM activity WHERE firm_key<>'' GROUP BY firm_key
) SELECT counts.*,(SELECT fs.updated_at FROM firm_settings fs WHERE fs.key=counts.firm_key AND trim(fs.banner_key)<>'') AS banner_version,EXISTS(SELECT 1 FROM firm_owners fo JOIN firm_claims fc ON fc.id=fo.claim_id JOIN client_profiles cp ON cp.user_id=fo.user_id WHERE fo.firm_key=counts.firm_key AND fc.status='approved' AND fc.firm_email_verified_at IS NOT NULL) AS ownership_verified,row_number() OVER (ORDER BY searches DESC,name COLLATE NOCASE,firm_key) AS rank FROM counts ORDER BY searches DESC,name COLLATE NOCASE,firm_key LIMIT 100`;
async function loadDiscoveryData(db:D1Database,includeCounts=false){
 await finalizeClosedAwards(db).catch(error=>console.error('Monthly award finalization failed',error));
 const now=new Date(),end=now.toISOString(),week=new Date(now.getTime()-7*86400000).toISOString(),month=monthStart(now);
 const [weekly,monthly,weeklyFirms,monthlyFirms,statuses,cities,ratedAll,ratedWeekly,ratedMonthly,catalog]=await Promise.all([
  db.prepare(attorneyChartSQL).bind(week,end).all(),db.prepare(attorneyChartSQL).bind(month,end).all(),
  db.prepare(firmChartSQL).bind(week,end,week,end).all(),db.prepare(firmChartSQL).bind(month,end,month,end).all(),
  db.prepare('SELECT DISTINCT status FROM attorneys ORDER BY status').all<{status:string}>(),
  db.prepare("SELECT city,count(*) AS attorneys FROM attorneys WHERE lower(trim(status)) IN ('active','active member in good standing','member in good standing') AND trim(city)<>'' GROUP BY city COLLATE NOCASE ORDER BY attorneys DESC,city LIMIT 8").all(),
  db.prepare(ratedAttorneyChartSQL).bind('',end).all(),db.prepare(ratedAttorneyChartSQL).bind(week,end).all(),db.prepare(ratedAttorneyChartSQL).bind(month,end).all(),practiceCatalog(db)
 ]);
 // Keep the homepage rotation full without adding invented weekly search ranks.
 const popular=weekly.results.slice(0,20).map(row=>({...row}));
 if(popular.length<20){
  const historical=await db.prepare(attorneyChartSQL).bind('',end).all();
  const seen=new Set(popular.map(row=>row.bar_number));
  for(const row of historical.results){if(popular.length>=20)break;if(!seen.has(row.bar_number)){popular.push({...row,rank:null});seen.add(row.bar_number);}}
  if(popular.length<20){
   const remaining=await db.prepare(`SELECT ${publicAttorneyColumns('a')},${ownershipVerifiedColumn('a')},(SELECT languages FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS languages,(SELECT photo_key FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS photo_key,(SELECT practice_areas FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS practice_areas FROM attorneys a WHERE lower(trim(a.status)) IN ('active','active member in good standing','member in good standing') AND a.bar_number NOT IN (SELECT value FROM json_each(?)) ORDER BY a.name COLLATE NOCASE,a.bar_number LIMIT ?`).bind(JSON.stringify([...seen]),20-popular.length).all();
   popular.push(...remaining.results.map(row=>({...row,rank:null})));
  }
 }
 const visible=(rows:Record<string,unknown>[])=>includeCounts?rows:rows.map(({searches,...row})=>row);
 return {popular:visible(popular),practiceCategories:catalog.areas,ratedAll:ratedAll.results,ratedWeekly:ratedWeekly.results,ratedMonthly:ratedMonthly.results,weekly:visible(weekly.results),monthly:visible(monthly.results),weeklyFirms:visible(weeklyFirms.results),monthlyFirms:visible(monthlyFirms.results),statuses:statuses.results.map(x=>x.status),cities:cities.results,monthLabel:new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'long',year:'numeric'}).format(now),updated:end};
}

// One computation per isolate/visibility mode, rather than ten queries per visitor.
const discoveryReaders=new WeakMap<D1Database,ReturnType<typeof publicReadCache<Awaited<ReturnType<typeof loadDiscoveryData>>>>>();
const ownerReaders=new WeakMap<D1Database,ReturnType<typeof publicReadCache<Awaited<ReturnType<typeof loadDiscoveryData>>>>>();
export function discoveryData(db:D1Database,includeCounts=false){
 const readers=includeCounts?ownerReaders:discoveryReaders;
 let read=readers.get(db);
 if(!read){read=publicReadCache(()=>readDeadline(loadDiscoveryData(db,includeCounts),12000),30000);readers.set(db,read);}
 return read();
}
