import { rawDb } from '../../../db/raw';
export async function GET(request: Request) {
 try {
  const u = new URL(request.url), db = rawDb();
  const id = u.searchParams.get('id');
  if (id) {
   const attorney = await db.prepare('SELECT * FROM attorneys WHERE bar_number = ?').bind(id).first();
   return Response.json({attorney}, {status: attorney ? 200 : 404});
  }
  const q = (u.searchParams.get('q') || '').trim().slice(0,150).toLowerCase();
  const city = (u.searchParams.get('city') || '').trim().slice(0,100).toLowerCase();
  const status = (u.searchParams.get('status') || '').trim().slice(0,100);
  const page = Math.min(10000, Math.max(1, Number.parseInt(u.searchParams.get('page') || '1') || 1));
  const clauses: string[] = [], args: string[] = [];
  const escape = (s: string) => s.replace(/[\\%_]/g, '\\$&');
  if(q) { clauses.push("(lower(name) LIKE ? ESCAPE '\\' OR lower(company) LIKE ? ESCAPE '\\' OR bar_number = ?)"); const pattern = '%'+q.split(/\s+/).map(escape).join('%')+'%'; args.push(pattern,pattern,q); }
  if(city) {clauses.push("lower(city) LIKE ? ESCAPE '\\'"); args.push('%'+city.split(/\s+/).map(escape).join('%')+'%');}
  if(status) {clauses.push('status = ?'); args.push(status);}
  const where = clauses.length ? ' WHERE '+clauses.join(' AND ') : '';
  const [rows,count,all,statuses] = await Promise.all([
   db.prepare('SELECT bar_number,name,company,city,county,status,admit_date,imported_at FROM attorneys'+where+' ORDER BY name COLLATE NOCASE,bar_number LIMIT 25 OFFSET ?').bind(...args,(page-1)*25).all(),
   db.prepare('SELECT count(*) AS total FROM attorneys'+where).bind(...args).first<{total:number}>(),
   db.prepare('SELECT count(*) AS total,max(imported_at) AS updated FROM attorneys').first<{total:number,updated:string}>(),
   db.prepare('SELECT DISTINCT status FROM attorneys ORDER BY status').all<{status:string}>()
  ]);
  return Response.json({attorneys:rows.results,total:count?.total||0,page,totalImported:all?.total||0,updated:all?.updated,statuses:statuses.results.map((r: {status: string})=>r.status)});
 } catch(error) {console.error('Attorney search failed',error);return Response.json({error:'Attorney records are temporarily unavailable. Please try again.'},{status:503});}
}

// Keep browser searches on a stable URL; filters are read-only request data.
export async function POST(request: Request) {
 let parameters: Record<string, unknown>;
 try {
  parameters = await request.json() as Record<string, unknown>;
 } catch {
  return Response.json({error:'Invalid search request.'},{status:400});
 }
 if (!parameters || Array.isArray(parameters) || typeof parameters !== 'object') {
  return Response.json({error:'Invalid search request.'},{status:400});
 }
 const url = new URL(request.url);
 url.search = '';
 for (const key of ['q','city','status','page','id']) {
  const value = parameters[key];
  if (value === undefined) continue;
  if (typeof value !== 'string' && !(key === 'page' && typeof value === 'number' && Number.isFinite(value))) {
   return Response.json({error:'Invalid search request.'},{status:400});
  }
  url.searchParams.set(key,String(value).slice(0,2000));
 }
 const response = await GET(new Request(url,{headers:request.headers}));
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
