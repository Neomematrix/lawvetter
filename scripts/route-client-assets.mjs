import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

async function rewrite(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(entry.name==='.rsync-tmp')continue;
  const path=resolve(directory,entry.name);
  if(entry.isDirectory()){await rewrite(path);continue;}
  if(!/\.(?:js|css|json)$/.test(entry.name))continue;
  const before=await readFile(path,'utf8');
  const after=before
   .replaceAll(/(?<![.\w])\/assets\/(?=[0-9a-f-]{36}\/)/g,'/api/lv-assets-')
   .replaceAll(/(?<![./\w-])assets\/(?=[0-9a-f-]{36}\/)/g,'api/lv-assets-');
  if(before!==after)await writeFile(path,after);
 }
}
await rewrite(resolve('dist/server'));
await rewrite(resolve('dist/client/assets'));
