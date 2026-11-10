import {adminIdentity} from '../../../../db/admin-auth';
import {rawDb} from '../../../../db/raw';
import {reclassifyVerifiedEmployers} from '../../../../db/employer-classification';
import {verifiedEmployer} from '../../../../db/verified-employers';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 if(!await adminIdentity(request))return json({error:'Sign in as administrator.'},401);
 const {results}=await rawDb().prepare("SELECT company AS name,COUNT(*) AS attorneys FROM attorneys WHERE trim(company)<>'' GROUP BY company ORDER BY company COLLATE NOCASE").all<{name:string;attorneys:number}>();
 return json({organizations:results.map(row=>({...row,verified:verifiedEmployer(row.name)||null}))});
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 if(!await adminIdentity(request))return json({error:'Sign in as administrator.'},401);
 try{return json({updated:await reclassifyVerifiedEmployers(rawDb())});}catch{return json({error:'Reclassification failed. Original records are retained; retry after checking the database.'},503);}
}
