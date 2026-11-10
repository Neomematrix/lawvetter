import {attorneyRankingActivitySQL,firmTotalRankingActivitySQL} from '../../../../db/ranking-activity';
import {clientIdentity} from '../../../../db/client-auth';
import {rawDb} from '../../../../db/raw';
import {firmAccess} from '../../../../db/firm-access';
import {firmKey,firmColumn} from '../../attorneys/firm';
import {resolveAttorneyReference} from '../../../../db/attorney-reference';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const client=await clientIdentity(request);if(!client)return json({error:'Log in to view analytics.'},401);const url=new URL(request.url),kind=url.searchParams.get('kind')==='firm'?'firm':'attorney',ref=url.searchParams.get('target')||'',db=rawDb();
 const target=kind==='firm'?firmKey(ref):await resolveAttorneyReference(ref);let name='';
 if(kind==='firm'){if(!await firmAccess(client.user,target))return json({error:'Approved firm access is required for private analytics.'},403);const row=await db.prepare("SELECT COALESCE(NULLIF(f.name,''),fc.firm_name) AS name FROM firm_owners fo JOIN firm_claims fc ON fc.id=fo.claim_id LEFT JOIN firm_settings f ON f.key=fo.firm_key WHERE fo.firm_key=?").bind(target).first<{name:string}>();name=row?.name||ref;}
 else {const row=await db.prepare('SELECT a.name,a.company,p.owner_id FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE a.bar_number=?').bind(target).first<{name:string;company:string;owner_id:string}>();if(!row||row.owner_id!==client.user&&!await firmAccess(client.user,firmKey(row.company)))return json({error:'Approved attorney or firm access is required for these analytics.'},403);name=row.name;}
 const range=url.searchParams.get('days'),days=range==='all'?'all':Number(range)===7?7:30,now=new Date(),end=now.toISOString(),first=days==='all'?'0000-01-01':new Date(now.getTime()-(days-1)*86400000).toISOString().slice(0,10),since=first+'T00:00:00.000Z';
 const table=kind==='firm'?'('+firmTotalRankingActivitySQL+')':'('+attorneyRankingActivitySQL+')',column=kind==='firm'?'firm_key':'bar_number';
 const [searches,visits]=await Promise.all([db.prepare('SELECT substr(created_at,1,10) AS day,COUNT(*) AS count FROM '+table+' WHERE '+column+'=? AND created_at>=? AND created_at<=? GROUP BY day ORDER BY day').bind(target,since,end).all<{day:string;count:number}>(),db.prepare("SELECT substr(created_at,1,10) AS day,COUNT(*) AS views,SUM(CASE WHEN source='google' THEN 1 ELSE 0 END) AS google FROM directory_page_views WHERE target_kind=? AND target_key=? AND created_at>=? AND created_at<=? GROUP BY day ORDER BY day").bind(kind,target,since,end).all<{day:string;views:number;google:number}>()]);
 const startDay=days==='all'?[...searches.results,...visits.results].map(row=>row.day).sort()[0]||end.slice(0,10):first;
 const length=days==='all'?Math.floor((Date.parse(end.slice(0,10)+'T12:00:00Z')-Date.parse(startDay+'T12:00:00Z'))/86400000)+1:days;
 const searchDays=new Map(searches.results.map(row=>[row.day,row.count])),visitDays=new Map(visits.results.map(row=>[row.day,row]));
 const series=Array.from({length},(_,index)=>{const date=new Date(startDay+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+index);const day=date.toISOString().slice(0,10),view=visitDays.get(day);return {day,searches:searchDays.get(day)||0,google:view?.google||0,views:view?.views||0};});
 return json({kind,target,name,days,series,totals:series.reduce((sum,day)=>({searches:sum.searches+day.searches,google:sum.google+day.google,views:sum.views+day.views}),{searches:0,google:0,views:0}),rankingNote:'Search totals include internal LawVetter searches and recorded Google search arrivals. Regular profile browsing is reported separately.',googleNote:'Visits arriving from Google, measured from the referring page. Tracking begins with this update; Google Search Console click totals are not connected.'});
 }catch{return json({error:'Analytics are temporarily unavailable.'},503);}}
