import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('app/practice-banner.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {practiceBannerImage}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// Keep similar fields distinct: sharing a theme must not share the photograph.
const categories=['family-law','litigation','personal-injury','criminal-defense','employment-law','estate-planning','business-law','immigration','financial-law','entertainment','judge','cannabis-law','aviation','business-and-commercial-disputes','civil-litigation','commercial-litigation','consumer','intellectual-property','international-arbitration','labor','litigation-and-disputes','patent','real-estate','social-security-and-disability','workers-compensation','contracts','tax'];
test('Every current practice banner has a different photo file and different image content',()=>{
 const paths=new Map(),hashes=new Map(),sources=JSON.parse(fs.readFileSync('data/practice-banner-sources.json','utf8')).images;
 const photoSources=new Map();
 for(const id of categories){
  const path=practiceBannerImage(id),data=fs.readFileSync('public'+path),hash=createHash('sha256').update(data).digest('hex');
  assert.ok(!paths.has(path),id+' reuses '+paths.get(path));assert.ok(!hashes.has(hash),id+' duplicates the image content of '+hashes.get(hash));
  const source=sources.find(item=>item.file==='public'+path);assert.ok(source,id+' needs image provenance');
  const original=new URL(source.source).pathname;assert.ok(!photoSources.has(original),id+' reuses the original photo for '+photoSources.get(original));
  paths.set(path,id);hashes.set(hash,id);photoSources.set(original,id);
 }
});
