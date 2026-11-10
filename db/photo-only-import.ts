import {env} from 'cloudflare:workers';
import {licensedAttorney} from './attorney-identity';
import {saveAttorney,validateAttorney} from './admin-records';
import {validateFloridaMemberRecord} from '../app/florida-bar-record';
export async function photoOnlyImport(rows:unknown[]){
 if(rows.length>25)throw Error('Import up to 25 photo records per batch.');
 const results:{barNumber:string;skipped?:'duplicate'|'no-photo';id?:string;created?:boolean;photo?:boolean;error?:string}[]=[];let created=0,duplicates=0,withoutPhoto=0;
 async function importRow(input:unknown){let photoKey='';const row=input as Record<string,unknown>;
  try{
   const attorney=validateAttorney(row);
   validateFloridaMemberRecord(row);
   if(await licensedAttorney('FL',attorney.barNumber!)){duplicates++;results.push({barNumber:attorney.barNumber!,skipped:'duplicate'});return;}
   if(typeof row.photoUrl!=='string'||!row.photoUrl){withoutPhoto++;results.push({barNumber:attorney.barNumber!,skipped:'no-photo'});return;}
   const url=new URL(row.photoUrl),photoLicense=url.pathname.match(/\/(\d+)p\.jpg$/)?.[1].replace(/^0+/,'');if(url.protocol!=='https:'||url.hostname!=='imageserver.floridabar.org'||url.username||url.password||url.port||photoLicense!==attorney.barNumber!.replace(/^0+/,''))throw Error('Photo must match the attorney’s Florida Bar number.');
   const image=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(!image.ok)throw Error('Official photo could not be downloaded (HTTP '+image.status+').');
   const declared=Number(image.headers.get('Content-Length')||0);if(declared>3*1024*1024)throw Error('Photo is too large.');
   const bytes=new Uint8Array(await image.arrayBuffer());const actualType=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===71&&bytes[1]===73&&bytes[2]===70&&bytes[3]===56?'image/gif':bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80?'image/webp':null;if(bytes.length<24||bytes.length>3*1024*1024||!actualType)throw Error('Invalid photo file.');
   photoKey='attorneys/FL:'+attorney.barNumber+'/'+crypto.randomUUID()+({"image/png":'.png',"image/jpeg":'.jpg',"image/gif":'.gif',"image/webp":'.webp'}[actualType]);
   await env.PROFILE_PHOTOS.put(photoKey,bytes,{httpMetadata:{contentType:actualType}});
   const saved=await saveAttorney({...attorney,status:'Active Member in Good Standing',practiceAreas:'Personal injury',photoKey},'Florida Bar photo import',true,true);
   if(saved.skipped){await env.PROFILE_PHOTOS.delete(photoKey);duplicates++;results.push({barNumber:attorney.barNumber!,skipped:'duplicate'});}else{created++;results.push({barNumber:attorney.barNumber!,id:saved.id,created:true,photo:true});}
   photoKey='';
  }catch(e){if(photoKey)await env.PROFILE_PHOTOS.delete(photoKey);results.push({barNumber:String(row?.barNumber||''),error:e instanceof Error?e.message:'Unable to import.'});}
 }
 for(let start=0;start<rows.length;start+=5)await Promise.all(rows.slice(start,start+5).map(importRow));
 return {created,duplicates,withoutPhoto,failed:results.filter(r=>'error' in r).length,results};
}
