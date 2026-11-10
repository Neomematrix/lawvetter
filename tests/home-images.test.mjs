import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

async function load(file,stubs={}){
 const context=vm.createContext({console}),cache=new Map();
 async function module(file){
  if(cache.has(file))return cache.get(file);
  let mod;
  if(stubs[file]){const values=stubs[file];mod=new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});}
  else if(file.endsWith('.webp')){assert.ok(fs.existsSync(file));mod=new vm.SyntheticModule(['default'],function(){this.setExport('default',{src:'/built/'+path.basename(file),width:192,height:192});},{context});}
  else{const actual=fs.existsSync(file)?file:file.replace(/\.ts$/,'.tsx');mod=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(actual,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{context,identifier:actual});}
  cache.set(file,mod);return mod;
 }
 const mod=await module(path.resolve(file));await mod.link((name,parent)=>module(stubs[name]?name:path.resolve(path.dirname(parent.identifier),name)+(name.endsWith('.webp')?'':'.ts')));await mod.evaluate();return mod.namespace;
}

test('Homepage portrait variants match current public revisions and preserve a fresh original fallback',async()=>{
 const {homePortrait}=await load('app/home-image.ts');
 const portrait={bar_number:'LV5fd9dd7dbbedcbd90b3a3710e8f0cb3b',photo_key:'p5f5a4560'};
 const card=homePortrait(portrait,'card'),small=homePortrait(portrait,'preview');
 assert.match(card.src,/^\/built\/.+\.webp$/);assert.match(card.srcSet,/ \d+w, /);assert.match(card.sizes,/700px/);
 assert.equal(small.sizes,'72px');assert.equal(small.srcSet.split(', ').length,2);
 const replaced=homePortrait({...portrait,photo_key:'punknown'},'card');
 assert.match(replaced.src,/^\/api\/profile-photo\?/);assert.equal(replaced.srcSet,undefined);
 assert.equal(homePortrait({bar_number:portrait.bar_number},'card').src,undefined);
});

test('Responsive homepage photos are opt-in; search cards retain their original image and identical card markup',async()=>{
 const nil=()=>null;
 const {AttorneyCard}=await load('app/AttorneyCard.tsx',{'react':React,'react/jsx-runtime':jsx,'./OwnershipSeal':{default:nil},'./YearsInPractice':{default:nil},'./AttorneyReviewSummary':{default:nil},'./FirmLink':{FirmLink:nil},'./Shortlist':{SaveAttorneyButton:nil}});
 const attorney={bar_number:'LV'+'a'.repeat(32),photo_key:'p123',name:'Example Lawyer',state:'GA',city:'Atlanta',status:'Active Member in Good Standing'};
 const render=photo=>renderToStaticMarkup(React.createElement(AttorneyCard,{attorney,photo,onOpen:()=>{}}));
 const standard=render(),responsive=render({src:'/home.webp',srcSet:'/home.webp 320w, /home-large.webp 640w',sizes:'300px'});
 assert.match(standard,/src="\/api\/profile-photo\?/);assert.doesNotMatch(standard,/srcSet=|sizes=/);
 const normalize=html=>html.replace(/ src="[^"]*"/g,'').replace(/ srcSet="[^"]*"/g,'').replace(/ sizes="[^"]*"/g,'');
 assert.equal(normalize(standard),normalize(responsive));
 assert.match(responsive,/width="440" height="400"/);assert.match(responsive,/loading="lazy"/);
});

test('Static image metadata and plain URLs both produce real URL strings',async()=>{
 const {imageSource}=await load('app/home-image-url.ts');
 assert.equal(imageSource({src:'/assets/portrait.webp',width:192,height:192}),'/assets/portrait.webp');
 assert.equal(imageSource('/assets/portrait.webp'),'/assets/portrait.webp');
});
