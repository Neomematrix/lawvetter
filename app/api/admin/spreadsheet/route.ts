import {isActiveMembership} from '../../../membership-status';
import {assertAttorneyAllowed,assertFirmAllowed} from '../../../../db/directory-deletions';
import {adminIdentity} from '../../../../db/admin-auth';
import {validateAttorney,saveAttorney} from '../../../../db/admin-records';
import {licensedAttorney} from '../../../../db/attorney-identity';
import {importFloridaSpreadsheet} from '../../../../db/spreadsheet-batch';
import {correctImportedNames} from '../../../../db/import-name-corrections';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 try{
  const identity=await adminIdentity(request);if(!identity)return json({error:'Sign in as administrator.'},401);
  const raw=await request.text();if(raw.length>1000000)return json({error:'Import too large.'},413);
  const d=JSON.parse(raw);if(!Array.isArray(d.rows)||!d.rows.length||d.rows.length>100)return json({error:'Import up to 100 rows per batch.'},400);
  if(d.rows.some((r:unknown)=>!!r&&typeof r==='object'&&'previousName' in r))return json(await correctImportedNames(d.rows,identity.email,d.preview===true));
  const offset=Number.isInteger(d.rowOffset)&&d.rowOffset>=2&&d.rowOffset<=1000000?d.rowOffset:2;
  const records=d.rows.map((row:unknown,index:number)=>{try{return validateAttorney(row);}catch(e){throw Error('Excel row '+(offset+index)+': '+(e instanceof Error?e.message:'Invalid attorney record.'));}});
  if(records.every((r:ReturnType<typeof validateAttorney>)=>r.state==='FL'&&r.barNumber&&!r.recordId))return json(await importFloridaSpreadsheet(records,d.rows,identity.email,d.preview===true));
  const seen=new Set<string>();let created=0,skipped=0,withoutPhoto=0;const results=[];
  for(const r of records){
   try{
    const key=r.state+':'+(r.barNumber||r.sourceUrl);
    if(seen.has(key)||await licensedAttorney(r.state!,r.barNumber!,r.sourceUrl)){
     skipped++;results.push({name:r.name,bar:r.barNumber,ok:true,skipped:true});continue;
    }
    const source=d.rows[records.indexOf(r)];if(!r.photoKey&&!source.photoFilename?.trim())withoutPhoto++;
    if(!isActiveMembership(r.status))throw Error('Verify active membership before saving.');
    await assertAttorneyAllowed(r.state!,r.barNumber!);await assertFirmAllowed(r.company||'');
    if(d.preview===true){created++;results.push({name:r.name,bar:r.barNumber,ok:true,skipped:false});}
    else{const saved=await saveAttorney(r,identity.email,true,true);saved.skipped?skipped++:created++;results.push({name:r.name,bar:r.barNumber,ok:true,id:saved.skipped?undefined:saved.id,skipped:saved.skipped});}
    seen.add(key);
   }catch(e){results.push({name:r.name,bar:r.barNumber,ok:false,error:e instanceof Error?e.message:'Unable to save this row. Retry after checking the record.'});}
  }
  return json({created,skipped,withoutPhoto,updated:0,results});
 }catch(e){return json({error:e instanceof Error?e.message:'Import failed.'},400);}
}
