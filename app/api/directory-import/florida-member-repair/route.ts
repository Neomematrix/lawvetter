import candidates from '../../../../data/florida-personal-injury-with-photos.json';
import verified from '../../../../data/florida-member-verified-records.json';
import {rawDb} from '../../../../db/raw';
import {parseFloridaMember,applyFloridaVerification,FloridaVerification} from '../../../../db/florida-member-repair';
const jobKey='florida-member-repair-2026-10-14';
type Progress={offset:number;verified:number;updated:number;skipped:number;error:string;lastBar:string;nextRequestAt?:number;prioritizedMolle?:boolean;attempts?:number;failures?:{barNumber:string;error:string}[]};
async function progress(){const row=await rawDb().prepare('SELECT value FROM site_settings WHERE key=?').bind(jobKey).first<{value:string}>();return row?JSON.parse(row.value) as Progress:{offset:0,verified:0,updated:0,skipped:0,error:'',lastBar:''};}
export async function GET(){const p=await progress();return Response.json({...p,total:candidates.length,complete:p.offset===candidates.length},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
 if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Same-origin request required.'},{status:403});
 // Temporary, fixed, reviewed repair only: no caller-supplied URLs, identities, SQL, or record data.
 const p=await progress();if((p.nextRequestAt||0)>Date.now())return Response.json({...p,total:candidates.length,complete:false},{headers:{'Cache-Control':'no-store'}});p.error='';
 if(!p.prioritizedMolle){const record=verified.find(r=>r.barNumber==='361011')!,original=candidates.find(r=>r.barNumber==='361011')!;if(await applyFloridaVerification(record,original.sourceUrl))p.updated++;else p.skipped++;p.verified++;p.prioritizedMolle=true;}
 for(let n=0;n<5&&p.offset<candidates.length;n++){
  const original=candidates[p.offset];p.lastBar=original.barNumber;if(original.barNumber==='361011'&&p.prioritizedMolle){p.offset++;continue;}
  try{
   const cached=await rawDb().prepare('SELECT value FROM site_settings WHERE key=?').bind('florida-member-verification:'+original.barNumber).first<{value:string}>();
   let record:FloridaVerification|undefined=cached?JSON.parse(cached.value):verified.find(r=>r.barNumber===original.barNumber);
   let fetched=false;
   if(!record){fetched=true;const response=await fetch('https://www.floridabar.org/mybarprofile/'+original.barNumber,{redirect:'follow',signal:AbortSignal.timeout(20000)});p.nextRequestAt=Date.now()+2000;if(response.status===429){const retry=response.headers.get('Retry-After');const seconds=retry&&/^\d+$/.test(retry)?Number(retry):retry?Math.ceil((Date.parse(retry)-Date.now())/1000):60;p.nextRequestAt=Date.now()+Math.max(60,Number.isFinite(seconds)?seconds:60)*1000;p.error='The Florida Bar rate limit is active. Waiting before the next request.';break;}if(!response.ok)throw Error('Official member service returned HTTP '+response.status+'.');record=parseFloridaMember(await response.text(),original.barNumber);}
   if(await applyFloridaVerification(record,original.sourceUrl))p.updated++;else p.skipped++;
   p.verified++;p.offset++;p.attempts=0;if(fetched)break;
  }catch(e){const error=e instanceof Error?e.message:'Member verification unavailable.';if(/HTTP 40[13]/.test(error)){p.nextRequestAt=undefined;p.error=error;break;}p.attempts=(p.attempts||0)+1;if(p.attempts<3){p.nextRequestAt=Date.now()+60000;p.error=error+' Waiting before retrying this member.';}else{(p.failures||=[]).push({barNumber:original.barNumber,error});p.offset++;p.attempts=0;p.nextRequestAt=Date.now()+2000;p.error='';}break;}
 }
 await rawDb().prepare('INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(jobKey,JSON.stringify(p),new Date().toISOString()).run();
 return Response.json({...p,total:candidates.length,complete:p.offset===candidates.length},{headers:{'Cache-Control':'no-store'}});
}
