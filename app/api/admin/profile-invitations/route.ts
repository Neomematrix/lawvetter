import {adminIdentity} from '../../../../db/admin-auth';
import {profileInvitation,sendProfileInvitation} from '../../../../db/profile-invitation';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 const admin=await adminIdentity(request);if(!admin)return json({error:'Sign in as administrator.'},401);
 try{
  const body=await request.text();if(body.length>2000)return json({error:'Request too large.'},413);
  const data=JSON.parse(body);
  if(typeof data.userId!=='string'||data.userId.length>200||typeof data.publicId!=='string'||! /^[a-f0-9]{32}$/.test(data.publicId))return json({error:'Choose an account and a valid attorney profile.'},400);
  if(data.action==='preview'){
   const {from,to,subject,text,fingerprint,delivery}=await profileInvitation(data.userId,data.publicId);
   return json({from,to,subject,text,fingerprint,sent:!!delivery?.providerId});
  }
  if(data.action==='send'&&typeof data.fingerprint==='string')return json(await sendProfileInvitation(data.userId,data.publicId,data.fingerprint,admin.email));
  return json({error:'Invalid action.'},400);
 }catch(e){return json({error:e instanceof Error?e.message:'Unable to send this message. Preview and retry.'},400);}
}
