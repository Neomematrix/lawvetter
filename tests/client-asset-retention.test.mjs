import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {retainClientAssets} from '../scripts/retain-client-assets.mjs';

test('Releases retain complete previous module graphs and prune expired assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lawvetter-assets-'));
 const assets=join(root,'dist/client/assets');
 try {
  for(let release=1;release<=3;release++) {
   await rm(assets,{recursive:true,force:true});await mkdir(assets,{recursive:true});
   await writeFile(join(assets,`entry-${release}.js`),`import './chunk-${release}.js'`);
   await writeFile(join(assets,`chunk-${release}.js`),`export const version=${release}`);
   await retainClientAssets(root,2);
   assert.equal(await readFile(join(assets,`entry-${release}.js`),'utf8'),`import './chunk-${release}.js'`);
   if(release>1)assert.equal(await readFile(join(assets,`chunk-${release-1}.js`),'utf8'),`export const version=${release-1}`);
  }
  await assert.rejects(readFile(join(assets,'entry-1.js')),{code:'ENOENT'});
  await assert.rejects(readFile(join(assets,'chunk-1.js')),{code:'ENOENT'});
 } finally {await rm(root,{recursive:true,force:true});}
});

test('Default retention preserves tabs across more than thirty consecutive deployments',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lawvetter-open-tab-')),assets=join(root,'dist/client/assets');
 try{
  for(let release=1;release<=35;release++){
   await rm(assets,{recursive:true,force:true});await mkdir(assets,{recursive:true});
   await writeFile(join(assets,`entry-${release}.js`),`import './chunk-${release}.js'`);
   await writeFile(join(assets,`chunk-${release}.js`),`export const version=${release}`);
   await retainClientAssets(root);
  }
  assert.equal(await readFile(join(assets,'entry-1.js'),'utf8'),"import './chunk-1.js'");
  assert.equal(await readFile(join(assets,'chunk-1.js'),'utf8'),'export const version=1');
 }finally{await rm(root,{recursive:true,force:true});}
});


test('In-progress synchronization files never enter retained releases or change their digest',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lawvetter-sync-')),assets=join(root,'dist/client/assets');
 try{
  await mkdir(join(assets,'.rsync-tmp'),{recursive:true});
  await writeFile(join(assets,'entry.js'),'complete public module');
  await writeFile(join(assets,'.entry.js.partial'),'incomplete adjacent sync file');
  await writeFile(join(assets,'.rsync-tmp','entry.js'),'incomplete transfer');
  assert.equal((await retainClientAssets(root)).current,1);
  await assert.rejects(readFile(join(root,'.openai/client-asset-history/files/.rsync-tmp/entry.js')),{code:'ENOENT'});
  await assert.rejects(readFile(join(root,'.openai/client-asset-history/files/.entry.js.partial')),{code:'ENOENT'});
  await writeFile(join(assets,'.rsync-tmp','entry.js'),'a different incomplete transfer');
  await writeFile(join(assets,'.entry.js.partial'),'different temporary bytes');
  await retainClientAssets(root);
  const releases=JSON.parse(await readFile(join(root,'.openai/client-asset-history/releases.json'),'utf8'));
  assert.equal(releases.length,1);assert.deepEqual(releases[0].files,['entry.js']);
 }finally{await rm(root,{recursive:true,force:true});}
});
