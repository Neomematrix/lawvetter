import {env} from 'cloudflare:workers';
import {rawDb} from '../../../../db/raw';
import {buildSearchIndexBatch} from '../../../../db/search-index';
function authorized(request:Request){const key=(env as unknown as Record<string,string>).SEARCH_INDEX_MAINTENANCE_KEY;return !!key&&request.headers.get('Authorization')==='Bearer '+key;}
export async function POST(request:Request){
 if(!authorized(request))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(await buildSearchIndexBatch(rawDb()),{headers:{'Cache-Control':'private, no-store'}});}catch(error){console.error('Search index batch failed',String(error));return Response.json({error:'Index batch failed; retry resumes safely'},{status:503});}
}
export async function GET(request:Request){
 if(!authorized(request))return Response.json({error:'Unauthorized'},{status:401});
 const db=rawDb();return Response.json(await db.prepare('SELECT attorney_cursor,firm_cursor,ready,(SELECT count(*) FROM attorneys) AS attorneys,(SELECT count(*) FROM attorney_search_fts) AS indexed_attorneys,(SELECT count(*) FROM firm_settings) AS firms,(SELECT count(*) FROM firm_search_fts) AS indexed_firms FROM search_index_progress WHERE id=1').first(),{headers:{'Cache-Control':'private, no-store'}});
}
