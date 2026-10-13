import {rawDb} from '../../../../db/raw';
import {profileIdentity} from '../../../../db/profile-access';
import {discoveryData} from '../../attorneys/charts';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(!(await profileIdentity(request)).admin)return Response.json({error:'Only the site owner can view search analytics.'},{status:403,headers});
 try{return Response.json(await discoveryData(rawDb(),true),{headers});}catch{return Response.json({error:'Search analytics are temporarily unavailable.'},{status:503,headers});}
}
