import {unzipSync,zipSync} from 'fflate';
import {readSheet} from 'read-excel-file/browser';

/** Keep XLSX decompression on this thread: the admin policy disallows blob workers. */
export async function readSpreadsheet(file:Blob){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   (async()=>{
    const bytes=new Uint8Array(await file.arrayBuffer());let expanded=0;
    const parts=unzipSync(bytes,{filter:entry=>{
     expanded+=entry.originalSize;
     if(expanded>50*1024*1024)throw Error('The expanded workbook is too large.');
     return /\.(?:xml|rels)$/i.test(entry.name);
    }});
    // Stored ZIP entries make the library's async unzip use its synchronous path.
    // All worksheet, shared-string and date-style XML stays unchanged.
    const stored=zipSync(parts,{level:0});
    return await readSheet(new Uint8Array(stored).buffer,1,{parseNumber:value=>value});
   })(),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('The spreadsheet could not finish loading. Please use the CSV version of this file.')),30000);}),
  ]);
 }finally{if(timer!==undefined)clearTimeout(timer);}
}
