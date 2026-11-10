import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const mod=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('app/firm-banner.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
await mod.link(()=>{});await mod.evaluate();
const {firmBannerError}=mod.namespace;
function png(w,h){const bytes=new Uint8Array(33);bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);const view=new DataView(bytes.buffer);view.setUint32(16,w);view.setUint32(20,h);return bytes;}
function jpeg(w,h,progressive=false){return Uint8Array.from([255,216,255,progressive?194:192,0,11,8,h>>8,h&255,w>>8,w&255,1,1,17,0,255,217]);}
for(const [format,encode] of [['PNG',png],['JPEG',jpeg],['progressive JPEG',(w,h)=>jpeg(w,h,true)]])test(format+' allows the boundary and rejects oversized or malformed banners',()=>{
 assert.equal(firmBannerError(encode(1600,533)),'');
 assert.equal(firmBannerError(encode(300,300)),'');
 for(const [w,h] of [[1601,533],[1600,534],[600,1000],[10000,10000]])assert.match(firmBannerError(encode(w,h)),/maximum is 1600 × 533/);
 assert.match(firmBannerError(encode(0,100)),/valid JPEG or PNG/);
 assert.match(firmBannerError(encode(200,100).slice(0,10)),/valid JPEG or PNG/);
});
