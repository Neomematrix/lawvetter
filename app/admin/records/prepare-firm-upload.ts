import {firmBannerError} from '../../firm-banner';
// Keep multipart uploads below the gateway limit while preserving the full image.
const targetBytes=900*1024;
export async function prepareFirmUpload(file:File,banner=true):Promise<File>{
 if(banner){const error=firmBannerError(new Uint8Array(await file.arrayBuffer()));if(error)throw Error(error);}
 if(file.size<=targetBytes)return file;
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('The firm image could not be prepared. Choose another JPEG or PNG.'));img.src=url;});
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw Error('The firm image could not be prepared.');
  let scale=Math.min(1,1600/image.naturalWidth,1600/image.naturalHeight);
  for(let attempt=0;attempt<10;attempt++){
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,file.type,0.9));
   if(blob&&blob.size<=targetBytes)return new File([blob],file.name,{type:blob.type,lastModified:file.lastModified});
   scale*=0.8;
  }
  throw Error('This firm image is still too large. Choose a smaller JPEG or PNG.');
 }finally{URL.revokeObjectURL(url);}
}
