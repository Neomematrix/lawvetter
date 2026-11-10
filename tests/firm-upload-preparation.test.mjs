import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
test('Firm uploads fit below 900 KB without cropping and preserve PNG transparency support',async()=>{
 const sizes=[],types=[],revoked=[];let attempts=0;
 const canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage(...args){sizes.push(args.slice(1));}}),toBlob(callback,type){types.push(type);attempts++;callback(new Blob([new Uint8Array(attempts===1?1000000:800000)],{type}));}};
 class Image{naturalWidth=1599;naturalHeight=533;set src(value){queueMicrotask(()=>this.onload());}}
 const context=vm.createContext({File,Blob,Image,Uint8Array,queueMicrotask,document:{createElement:()=>canvas},URL:{createObjectURL:()=>'/image',revokeObjectURL:url=>revoked.push(url)}});
 const code=ts.transpileModule(fs.readFileSync('app/admin/records/prepare-firm-upload.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText,m=new vm.SourceTextModule(code,{context});await m.link(async()=>{const child=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('app/firm-banner.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText,{context});await child.link(()=>{});return child;});await m.evaluate();
 const png=new Uint8Array(33);png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,6,64,0,0,2,21]);const small=new File([png],'small.png',{type:'image/png'});assert.equal(await m.namespace.prepareFirmUpload(small),small);assert.equal(attempts,0);
 const bytes=new Uint8Array(2300000);bytes.set(png);const large=new File([bytes],'banner.png',{type:'image/png'}),result=await m.namespace.prepareFirmUpload(large);assert.ok(result.size<=900*1024);assert.equal(result.type,'image/png');assert.equal(result.name,'banner.png');assert.equal(types.join(','),'image/png,image/png');assert.deepEqual(revoked,['/image']);const tall=png.slice();tall.set([0,0,4,0],20);await assert.rejects(m.namespace.prepareFirmUpload(new File([tall],'tall.png',{type:'image/png'})),/maximum is 1600 × 533/);for(const [x,y,width,height] of sizes){assert.equal(x,0);assert.equal(y,0);assert.ok(Math.abs(width/height-3)<0.01);assert.ok(width<=1600);}
});
