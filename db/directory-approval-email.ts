import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {directoryDetails,withDirectoryDetails,type Notice} from './directory-details';
import {escapeHtml,mailButton} from './mail-markup';

type ApprovalRow={id:string;kind:string;name:string;state:string;bar_number:string;submitter_name:string;submitter_email:string;notes:string;status:string};
// Only published submissions can send approval mail. Keep a stable payload and
// provider key across retries so a timeout cannot send duplicate confirmations.
export async function sendDirectoryApproval(id:string){
 try{
  const db=rawDb(),row=await db.prepare("SELECT * FROM directory_submissions WHERE id=? AND status='published'").bind(id).first<ApprovalRow>();
  if(!row?.submitter_email)return 'unavailable';
  const details=directoryDetails(row.notes),now=Date.now();let notice=details.approvalNotice;
  if(notice?.status==='accepted')return 'accepted';
  if(notice?.leaseUntil&&notice.leaseUntil>now)return 'pending';
  if(notice?.firstAttempt&&now-notice.firstAttempt>23*3600000)return 'check-provider';
  const config=env as unknown as {RESEND_API_KEY?:string;APPROVAL_EMAIL_FROM?:string};
  if(!notice){
   const attorney=row.kind==='lawyer'?await db.prepare("SELECT bar_number FROM attorneys WHERE source_id=? LIMIT 1").bind('owner-reviewed:'+id).first<{bar_number:string}>():null;
   if(row.kind==='lawyer'&&!attorney)return 'unavailable';
   const url='https://www.lawvetter.com'+(row.kind==='firm'?'/firm?name='+encodeURIComponent(row.name):'/attorney?bar='+encodeURIComponent(attorney!.bar_number)+'&state='+encodeURIComponent(row.state));
   const greeting='Hello '+row.submitter_name+',',message='Your submission for '+row.name+' has been approved and published on LawVetter.',thanks='Thank you for helping us keep the directory up to date.';
   notice={status:'pending',payload:JSON.stringify({from:config.APPROVAL_EMAIL_FROM||'LawVetter <no-reply@lawvetter.com>',to:[row.submitter_email],subject:'Your LawVetter listing has been approved',text:greeting+'\n\n'+message+'\n\nView the listing: '+url+'\n\n'+thanks,html:'<h1>Your listing has been approved</h1><p>'+escapeHtml(greeting)+'</p><p>'+escapeHtml(message)+'</p>'+mailButton('View listing',url)+'<p>'+escapeHtml(thanks)+'</p>'})};
  }
  const next:Notice={...notice,...(config.RESEND_API_KEY?{firstAttempt:notice.firstAttempt||now,leaseUntil:now+30000}:{})};
  const queued=withDirectoryDetails(row.notes,{approvalNotice:next});
  const lease=await db.prepare("UPDATE directory_submissions SET notes=? WHERE id=? AND notes=? AND status='published'").bind(queued,id,row.notes).run();
  if(!lease.meta.changes)return 'pending';
  if(!config.RESEND_API_KEY)return 'pending';
  let providerId='';
  try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'directory-approved/'+id},body:next.payload,signal:AbortSignal.timeout(8000)});const data=await response.json() as {id?:string};if(response.ok&&data.id)providerId=data.id;}catch{}
  for(let attempt=0;attempt<3;attempt++){
   const latest=await db.prepare('SELECT notes FROM directory_submissions WHERE id=?').bind(id).first<{notes:string}>();if(!latest)return 'pending';
   const current=directoryDetails(latest.notes).approvalNotice;if(!current||current.payload!==next.payload)return 'pending';
   const updated=withDirectoryDetails(latest.notes,{approvalNotice:{...current,leaseUntil:0,...(providerId?{status:'accepted',providerId}:{})}});
   const saved=await db.prepare('UPDATE directory_submissions SET notes=? WHERE id=? AND notes=?').bind(updated,id,latest.notes).run();if(saved.meta.changes)return providerId?'accepted':'pending';
  }
  return 'pending';
 }catch{return 'unavailable';}
}
export async function retryDirectoryApprovals(){
 const rows=await rawDb().prepare("SELECT id,notes FROM directory_submissions WHERE status='published' AND notes LIKE '%\"approvalNotice\":{\"status\":\"pending\"%' ORDER BY reviewed_at DESC LIMIT 5").all<{id:string;notes:string}>();
 for(const row of rows.results)if(directoryDetails(row.notes).approvalNotice?.status==='pending')await sendDirectoryApproval(row.id);
}
