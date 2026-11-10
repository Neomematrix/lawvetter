import {rawDb} from '../../../../db/raw';
import {clientIdentity,checkPassword,allowAuth,sessionCookie} from '../../../../db/client-auth';
import {deleteOwnAccount} from '../../../../db/account-deletion';
const json=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function GET(request:Request){try{
 const client=await clientIdentity(request);if(!client)return json({error:'Log in to manage your account.'},401);
 const {results}=await rawDb().prepare("SELECT a.name FROM attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number WHERE p.owner_id=? AND p.claimed_at<>'' ORDER BY a.name").bind(client.user).all<{name:string}>();
 return json({profiles:results});
}catch{return json({error:'Unable to load account details. Please try again.'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 const client=await clientIdentity(request);if(!client)return json({error:'Log in before deleting your account.'},401);
 const text=await request.text();if(text.length>2000)return json({error:'Request too large.'},413);
 let data;try{data=JSON.parse(text);}catch{return json({error:'Invalid request.'},400);}
 if(data?.confirmation!=='DELETE'||typeof data.password!=='string'||!data.password||data.password.length>128)return json({error:'Enter your password and type DELETE to confirm.'},400);
 if(!await allowAuth(request,client.email))return json({error:'Too many attempts. Please wait 15 minutes.'},429);
 const row=await rawDb().prepare('SELECT password_hash FROM client_passwords WHERE user_id=?').bind(client.user).first<{password_hash:string}>();
 if(!checkPassword(data.password,row?.password_hash||''))return json({error:'Your password is incorrect.'},401);
 await deleteOwnAccount(client.user);
 return json({deleted:true},200,sessionCookie(''));
}catch{return json({error:'Unable to delete your account. Please try again or contact us.'},503);}}
