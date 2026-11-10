import {clientIdentity} from '../../../../db/client-auth';
import {viewAsToken} from '../../../../db/view-as-cookie';
import {emailAccessStatus,sendAccessConfirmation,confirmAccessEmail} from '../../../../db/automatic-profile-access';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{const client=await clientIdentity(request);return client?json(await emailAccessStatus(client)):json({matched:false,verified:false});}catch{return json({error:'Unable to check email access.'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 if(viewAsToken(request))return json({error:'Return to your own account to confirm email ownership.'},403);
 const client=await clientIdentity(request);if(!client)return json({error:'Sign in to the account that requested this email.'},401);
 const text=await request.text();if(text.length>500)return json({error:'Invalid request.'},400);const data=JSON.parse(text);
 if(data.action==='send'){const status=await sendAccessConfirmation(client,new URL(request.url).origin);return status==='unavailable'?json({error:'Email could not be sent. Try again shortly.'},503):json({status});}
 if(data.action==='confirm'&&typeof data.token==='string'){return await confirmAccessEmail(client,data.token)?json({confirmed:true}):json({error:'This link was replaced, was already used, or belongs to a different account. Request a new email from your dashboard.'},400);}
 return json({error:'Invalid request.'},400);
 }catch{return json({error:'Unable to confirm your email. Try again shortly.'},503);}}
