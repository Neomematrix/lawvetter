import {firmColumn} from '../app/api/attorneys/firm';

// The old profile tracker retained Google source + target, but no browser identity.
// Recover one conservative point per target/UTC day only where the dedicated
// referral tracker has no mapped arrival. Never add both counters for that day.
// Restrict this recovery to history before the corrected referral tracker went live.
export const googleHistoryCutoff='2026-11-03T03:24:55.573Z';
// Group immutable legacy views before checking mapped arrivals. Name resolution
// uses the normalized expression index; unary + removes outer TEXT affinity.
export const historicalGoogleAttorneyActivitySQL=`SELECT 'google-history:'||v.event_id AS event_id,v.target_key AS bar_number,v.created_at FROM (
 SELECT MIN(event_id) AS event_id,target_key,substr(created_at,1,10) AS day,MIN(created_at) AS created_at
 FROM directory_page_views WHERE target_kind='attorney' AND source='google' AND created_at<'${googleHistoryCutoff}' GROUP BY target_key,substr(created_at,1,10)
 ) v WHERE NOT EXISTS(SELECT 1 FROM search_referral_visits r WHERE r.source='google' AND r.bar_number=v.target_key AND r.created_at>=v.day AND r.created_at<date(v.day,'+1 day'))`;
export const historicalGoogleFirmActivitySQL=`SELECT 'google-firm-history:'||v.event_id AS event_id,v.target_key AS firm_key,
 COALESCE(NULLIF(fs.name,''),(SELECT MIN(a.company) FROM attorneys a WHERE ${firmColumn('a.company')}=+v.target_key),v.target_key) AS firm_name,v.created_at FROM (
 SELECT MIN(event_id) AS event_id,target_key,substr(created_at,1,10) AS day,MIN(created_at) AS created_at
 FROM directory_page_views WHERE target_kind='firm' AND source='google' AND created_at<'${googleHistoryCutoff}' GROUP BY target_key,substr(created_at,1,10)
 ) v LEFT JOIN firm_settings fs ON fs.key=v.target_key
 WHERE NOT EXISTS(SELECT 1 FROM google_firm_arrivals r WHERE r.firm_key=v.target_key AND r.created_at>=v.day AND r.created_at<date(v.day,'+1 day'))`;

// Preserve all internal searches and mapped referrals; namespace external event IDs.
export const attorneyRankingActivitySQL=`SELECT event_id,bar_number,created_at FROM attorney_search_events
 UNION ALL SELECT 'google:'||event_key AS event_id,bar_number,created_at FROM search_referral_visits WHERE source='google' AND bar_number<>''
 UNION ALL ${historicalGoogleAttorneyActivitySQL}`;
export const firmRankingActivitySQL=`SELECT event_id,firm_key,firm_name,created_at FROM firm_search_events
 UNION ALL SELECT 'google-firm:'||event_key AS event_id,firm_key,firm_name,created_at FROM google_firm_arrivals
 UNION ALL ${historicalGoogleFirmActivitySQL}`;

export const firmTotalRankingActivitySQL=`SELECT event_id,firm_key,MIN(created_at) AS created_at FROM (
 SELECT e.event_id,${firmColumn('a.company')} AS firm_key,e.created_at FROM (${attorneyRankingActivitySQL}) e JOIN attorneys a ON a.bar_number=e.bar_number WHERE trim(a.company)<>''
 UNION ALL SELECT event_id,firm_key,created_at FROM (${firmRankingActivitySQL})
) GROUP BY event_id,firm_key`;
