import {copyFile, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Keep ninety recent client module graphs so tabs opened before a release can
// still import their original chunks. Only public, compiled assets go here.
export async function retainClientAssets(root, keep=90) {
 const output=resolve(root,'dist/client/assets');
 const history=resolve(root,'.openai/client-asset-history');
 const files=resolve(history,'files');
 async function list(directory) {
  const entries=(await readdir(directory,{withFileTypes:true})).filter(entry=>!entry.name.startsWith('.'));
  return (await Promise.all(entries.map(async entry=>entry.isDirectory()
   ? (await list(resolve(directory,entry.name))).map(name=>entry.name+'/'+name)
   : [entry.name]))).flat().sort();
 }
 // Copy the stable asset list, not transient sync files that can disappear
 // between recursive directory enumeration and filesystem stat calls.
 async function copyAssets(source,destination) {
  const names=await list(source);
  await mkdir(destination,{recursive:true});
  const directories=new Set(names.map(name=>dirname(resolve(destination,name))));
  await Promise.all([...directories].map(directory=>mkdir(directory,{recursive:true})));
  for(let i=0;i<names.length;i+=32)await Promise.all(names.slice(i,i+32).map(name=>copyFile(resolve(source,name),resolve(destination,name))));
 }
 const current=await list(output);
 const digest=createHash('sha256');
 for(const name of current){digest.update(name);digest.update(await readFile(resolve(output,name)));}
 const id=digest.digest('hex');
 let releases=[];
 try{releases=JSON.parse(await readFile(resolve(history,'releases.json'),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;}
 releases=[{id,files:current},...releases.filter(release=>release.id!==id)].slice(0,keep);
 await mkdir(files,{recursive:true});
 await copyAssets(output,files);
 const retained=new Set(releases.flatMap(release=>release.files));
 for(const name of await list(files))if(!retained.has(name))await rm(resolve(files,name));
 await writeFile(resolve(history,'releases.json'),JSON.stringify(releases,null,2)+'\n');
 await copyAssets(files,output);
 return {current:current.length,retained:retained.size};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 console.log('Client asset retention:',await retainClientAssets(process.cwd()));
}
