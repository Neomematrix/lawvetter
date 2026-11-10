export async function validateClientEvidence(file:File|null){
 if(!file)return null;
 if(file.size<24||file.size>20*1024*1024)throw Error('Choose a PDF, JPG, or PNG file up to 20 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,pdf=[37,80,68,70,45].every((v,i)=>bytes[i]===v);
 if(!png&&!jpeg&&!pdf)throw Error('Proof must be a PDF, JPG, or PNG file.');
 return {bytes,type:png?'image/png':jpeg?'image/jpeg':'application/pdf',extension:png?'.png':jpeg?'.jpg':'.pdf',name:file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,200)||'Court record'};
}
