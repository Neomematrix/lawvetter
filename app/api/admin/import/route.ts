import {licensedAttorney,directoryAttorneyId} from '../../../../db/attorney-identity';
import { env } from 'cloudflare:workers';
import { rawDb } from '../../../../db/raw';
export async function GET(request:Request){
 const key=(env as unknown as Record<string,string>).ATTORNEY_IMPORT_KEY;
 if(!key||request.headers.get('Authorization')!=='Bearer '+key)return Response.json({error:'Unauthorized'},{status:401});
 try{
  const state=new URL(request.url).searchParams.get('state')||'GA';if(!['GA','FL'].includes(state))return Response.json({error:'Invalid state'},{status:400});
  const rows=await rawDb().prepare("SELECT COALESCE(license_number,bar_number) AS bar_number FROM attorneys WHERE state=? ORDER BY bar_number").bind(state).all<{bar_number:string}>();
  return Response.json({bars:rows.results.map(r=>r.bar_number)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Audit unavailable'},{status:503});}
}
export async function POST(request: Request) {
 const key = (env as unknown as Record<string,string>).ATTORNEY_IMPORT_KEY;
 if (!key || request.headers.get('Authorization') !== 'Bearer '+key) return Response.json({error:'Unauthorized'},{status:401});
 try {
 const rows = await request.json();
 if(!Array.isArray(rows) || rows.length<1 || rows.length>500) return Response.json({error:'Expected 1–500 records'},{status:400});
 const fields = ['barNumber','id','name','company','city','state','county','status','admitDate','lawSchool','address','zip','phone','email','sourceUrl','importedAt'];
 for(const row of rows) {
  if(!row || fields.some(k=>typeof row[k]!=='string' || row[k].length>2000) || !/^[A-Za-z0-9]{1,20}$/.test(row.barNumber) || !row.name.trim() || !['GA','FL'].includes(row.state) || (row.state==='GA'&&!/^https:\/\/www\.gabar\.org\/member-directory\/\?id=[A-F0-9]+$/.test(row.sourceUrl))) return Response.json({error:'Invalid attorney record'},{status:400});
  if(row.state==='FL'&&(row.status!=='Active Member in Good Standing'||row.membershipStatus!=='Member in Good Standing'||row.eligibility!=='Eligible to Practice Law in Florida'||row.sourceUrl!=='https://www.floridabar.org/directories/find-mbr/profile/?num='+row.barNumber))return Response.json({error:'Florida records require confirmed good standing, eligibility, and the matching official profile link.'},{status:400});
 }
 const db = rawDb();
 const identities=await Promise.all(rows.map(async row=>(await licensedAttorney(row.state,row.barNumber))?.bar_number||await directoryAttorneyId(row.state,row.barNumber)));
 await db.batch(rows.map((row,i)=>db.prepare("INSERT INTO attorneys (license_number,bar_number,source_id,name,company,city,state,county,status,admit_date,law_school,address,zip,phone,email,source_url,imported_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(bar_number) DO UPDATE SET license_number=excluded.license_number,source_id=excluded.source_id,name=excluded.name,company=CASE WHEN excluded.state='FL' AND excluded.company='' THEN attorneys.company ELSE excluded.company END,city=excluded.city,state=excluded.state,county=CASE WHEN excluded.state='FL' AND excluded.county='' THEN attorneys.county ELSE excluded.county END,status=excluded.status,admit_date=CASE WHEN excluded.state='FL' AND excluded.admit_date='' THEN attorneys.admit_date ELSE excluded.admit_date END,law_school=CASE WHEN excluded.state='FL' AND excluded.law_school='' THEN attorneys.law_school ELSE excluded.law_school END,address=CASE WHEN excluded.state='FL' AND excluded.address='' THEN attorneys.address ELSE excluded.address END,zip=CASE WHEN excluded.state='FL' AND excluded.zip='' THEN attorneys.zip ELSE excluded.zip END,phone=CASE WHEN excluded.state='FL' AND excluded.phone='' THEN attorneys.phone ELSE excluded.phone END,email=CASE WHEN excluded.state='FL' AND excluded.email='' THEN attorneys.email ELSE excluded.email END,source_url=excluded.source_url,imported_at=excluded.imported_at").bind(row.barNumber,identities[i],...fields.slice(1).map(k=>row[k]))));
 return Response.json({saved:rows.length});
 }catch(error){console.error('Attorney import failed',error);return Response.json({error:'Import failed'},{status:500});}
}
