import jpeg from 'jpeg-js';
import {decode as decodePng} from 'fast-png';
import {stageProposal} from './engine.mjs';
// No face synthesis, relighting, face restoration or generative image service.
export function imageQuality(bytes, kind='photo') {
  if(bytes.length>3*1024*1024)throw Error('Image exceeds 3 MB');
  let image;
  if(bytes[0]===137&&bytes[1]===80) {
    if(bytes.length<24)throw Error('Invalid PNG');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=view.getUint32(16),h=view.getUint32(20);
    if(!w||!h||w*h>4000000)throw Error('Image exceeds 4 megapixels');
    image=decodePng(bytes);if(image.depth!==8||![3,4].includes(image.channels))throw Error('Use an 8-bit RGB/RGBA PNG or JPEG');
  } else if(bytes[0]===255&&bytes[1]===216) image=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:4,maxMemoryUsageInMB:64});
  else throw Error('Only raster PNG/JPEG originals are supported');
  const {width,height,data}=image,channels=image.channels||4;
  if(width*height>4000000)throw Error('Image exceeds 4 megapixels');
  const gray=(x,y)=>{const i=(y*width+x)*channels;return .299*data[i]+.587*data[i+1]+.114*data[i+2];};
  let n=0,sum=0,squares=0;const step=Math.max(1,Math.floor(Math.max(width,height)/256));
  for(let y=Math.max(1,Math.floor(height*.15));y<height*.85-1;y+=step)for(let x=Math.max(1,Math.floor(width*.15));x<width*.85-1;x+=step){const v=4*gray(x,y)-gray(x-1,y)-gray(x+1,y)-gray(x,y-1)-gray(x,y+1);n++;sum+=v;squares+=v*v;}
  const sharpness=n?squares/n-(sum/n)**2:0,reasons=[];
  if(width<(kind==='banner'?600:400)||height<(kind==='banner'?150:400))reasons.push('Low resolution');
  if(kind==='photo'&&sharpness<30)reasons.push('Possible blur or heavy smoothing; human inspection required');
  if(kind==='photo'&&(width/height<.55||width/height>1.35))reasons.push('Unusual portrait crop; human inspection required');
  return {width,height,sharpness:Math.round(sharpness),reasons};
}
export function transformOptions(kind,width) {
  return kind==='banner'?{width,height:width===1600?533:267,fit:'contain',background:'#ffffff',sharpen:.3}:{width,height:Math.round(width*1.25),fit:'contain',background:'#ffffff',sharpen:.3};
}
export async function stageImage(db, bucket, images, item, bytes) {
  if(!item.rights||item.rights.trim().length<20||item.identityConfirmed!==true)throw Error('Confirm identity/design and document image usage rights');
  const url=new URL(item.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('HTTPS source evidence required');
  const quality=imageQuality(bytes,item.kind);
  const id=crypto.randomUUID(),prefix='enrichment/'+id+'/',originalKey=prefix+'original',desktopKey=prefix+'desktop.webp',mobileKey=prefix+'mobile.webp';
  // Every variant starts from the same preserved original. Contain preserves the
  // whole face/wordmark. Modest sharpening only; no inferred details or noise fill.
  await bucket.put(originalKey,bytes,{httpMetadata:{contentType:bytes[0]===137?'image/png':'image/jpeg'}});
  for(const [width,key] of [[item.kind==='banner'?1600:800,desktopKey],[item.kind==='banner'?800:400,mobileKey]]) {
    const result=await images.input(new Blob([bytes]).stream()).transform(transformOptions(item.kind,width)).output({format:'image/webp',quality:90});
    const response=result.response();if(!response.ok)throw Error('Image transform failed');
    await bucket.put(key,response.body,{httpMetadata:{contentType:'image/webp'}});
  }
  await db.prepare('INSERT INTO enrichment_image_variants(desktop_key,mobile_key,original_key,kind) VALUES(?,?,?,?)').bind(desktopKey,mobileKey,originalKey,item.kind).run();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  await stageProposal(db,{...item,proposed:desktopKey,conflict:false,explanation:`Owner-confirmed ${item.kind==='photo'?'attorney photograph':'firm logo'}. Original preserved; contain resize and mild sharpening only. Original ${quality.width} × ${quality.height}. ${quality.reasons.join('; ')}. Review face/design and both variants before approving.`,evidence:{url:url.href,retrievedAt:new Date().toISOString(),contentHash:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),excerpt:item.identityNote,verified:true,rights:item.rights}});
  return {quality};
}
export async function inspectImages(db,bucket,common) {
  const {attorney,source,...base}=common;
  let reasons=['Missing attorney photograph'];
  if(attorney.photo_key){try{const file=await bucket.get(attorney.photo_key);if(file&&file.size<=3*1024*1024)reasons=imageQuality(new Uint8Array(await file.arrayBuffer())).reasons;else reasons=['Image unavailable or too large for safe inspection'];}catch{reasons=['Image requires manual format/quality inspection'];}}
  const evidence={url:source.url,retrievedAt:source.retrievedAt,contentHash:source.hash,excerpt:'Quality triage only; no photo identity or reproduction rights have been verified.',verified:false};
  if(reasons.length)await stageProposal(db,{...base,kind:'photo',field:'photo_key',original:attorney.photo_key,proposed:'',conflict:true,explanation:reasons.join('; ')+'. Supply an authorized original and confirm identity before staging an enhancement.',evidence});
  if(attorney.company) {
    const asset=await db.prepare('SELECT banner_key FROM enrichment_firm_assets WHERE firm_name=?').bind(attorney.company).first();
    if(!asset?.banner_key)await stageProposal(db,{...base,entity:'firm',entityId:attorney.company,name:attorney.company,baseIdentity:JSON.stringify([attorney.company,attorney.state]),kind:'banner',field:'banner_key',original:'',proposed:'',conflict:true,explanation:'No owner-approved 1600 × 533 banner. Supply the authorized full firm logo; preserve its colors, type and proportions.',evidence:{...evidence,contentHash:'missing-banner'}});
  }
}
