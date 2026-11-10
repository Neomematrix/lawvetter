import {attorneyRankingActivitySQL} from './ranking-activity';
// Aggregate activity once for the matching roster, rather than re-grouping
// historical Google views separately for every attorney in a large firm.
export function firmRosterRankingSQL(fields:string,where:string,pageSize:number){
 return `WITH roster AS MATERIALIZED (
 SELECT ${fields} FROM attorneys WHERE ${where}
 ), counts AS MATERIALIZED (
 SELECT e.bar_number,count(*) AS searches FROM (${attorneyRankingActivitySQL}) e
 WHERE e.created_at>=? AND e.created_at<=? AND e.bar_number IN (SELECT bar_number FROM roster)
 GROUP BY e.bar_number
 ) SELECT roster.* FROM roster LEFT JOIN counts ON counts.bar_number=roster.bar_number
 ORDER BY COALESCE(counts.searches,0) DESC,roster.name COLLATE NOCASE,roster.bar_number LIMIT ${pageSize} OFFSET ?`;
}
