import { env } from 'cloudflare:workers';
import { rawDb } from '../../../../db/raw';
export async function POST(request: Request) {
 const key = (env as unknown as Record<string,string>).ATTORNEY_IMPORT_KEY;
 if (!key || request.headers.get('Authorization') !== 'Bearer '+key) return Response.json({error:'Unauthorized'},{status:401});
 try {
 const rows = await request.json();
 if(!Array.isArray(rows) || rows.length<1 || rows.length>100) return Response.json({error:'Expected 1–100 records'},{status:400});
 const fields = ['barNumber','id','name','company','city','state','county','status','admitDate','lawSchool','address','zip','phone','email','sourceUrl','importedAt'];
 for(const row of rows) {
  if(!row || fields.some(k=>typeof row[k]!=='string' || row[k].length>2000) || !/^[A-Za-z0-9]{1,20}$/.test(row.barNumber) || !row.name.trim() || row.state!=='GA' || !/^https:\/\/www\.gabar\.org\/member-directory\/\?id=[A-F0-9]+$/.test(row.sourceUrl)) return Response.json({error:'Invalid attorney record'},{status:400});
 }
 const db = rawDb();
 await db.batch(rows.map(row=>db.prepare('INSERT INTO attorneys (bar_number,source_id,name,company,city,state,county,status,admit_date,law_school,address,zip,phone,email,source_url,imported_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(bar_number) DO UPDATE SET source_id=excluded.source_id,name=excluded.name,company=excluded.company,city=excluded.city,state=excluded.state,county=excluded.county,status=excluded.status,admit_date=excluded.admit_date,law_school=excluded.law_school,address=excluded.address,zip=excluded.zip,phone=excluded.phone,email=excluded.email,source_url=excluded.source_url,imported_at=excluded.imported_at').bind(...fields.map(k=>row[k]))));
 return Response.json({saved:rows.length});
 }catch(error){console.error('Attorney import failed',error);return Response.json({error:'Import failed'},{status:500});}
}
