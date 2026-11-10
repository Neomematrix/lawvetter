import {profileIdentity} from '../../../../db/profile-access';
import {listLeadReplies,sendLeadReply} from '../../../../db/lead-replies';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){if(!(await profileIdentity(request)).admin)return reply({error:'Only the site owner can view replies.'},403);const id=new URL(request.url).searchParams.get('id');if(!id)return reply({error:'Choose an inquiry.'},400);try{return reply({replies:await listLeadReplies(id)});}catch{return reply({error:'Reply history is temporarily unavailable.'},503);}}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Send replies from LawVetter.'},403);
 const identity=await profileIdentity(request);if(!identity.admin)return reply({error:'Only the site owner can send replies.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'Unsupported format.'},415);
 try{const text=await request.text();if(text.length>14000)return reply({error:'Your reply is too long.'},413);let x;try{x=JSON.parse(text);}catch{return reply({error:'Invalid reply.'},400);}
 if(!x||typeof x.leadId!=='string'||x.leadId.length>100||typeof x.id!=='string'||!/^[-0-9a-f]{36}$/i.test(x.id)||typeof x.subject!=='string'||typeof x.body!=='string'||!x.subject.trim()||x.subject.length>180||/[\r\n]/.test(x.subject)||!x.body.trim()||x.body.length>10000)return reply({error:'Enter a subject and message (up to 10,000 characters).'},400);
 const status=await sendLeadReply(x.leadId,x.id,x.subject.trim(),x.body.trim(),identity.user);return reply({status},status==='accepted'?200:202);
 }catch(e){return reply({error:e instanceof Error?e.message:'Unable to send. Your draft is still here.'},503);}
}
