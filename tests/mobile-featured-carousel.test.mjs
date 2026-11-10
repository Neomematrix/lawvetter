import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {createRoot} from 'react-dom/client';
for(const scenario of [
 {name:'matching mobile leader',mobile:true,featured:'a',count:5,expected:['b']},
 {name:'different mobile leader',mobile:true,featured:'b',count:5,expected:['a']},
 {name:'desktop leader',mobile:false,featured:'a',count:5,expected:['a','b','c','d']},
 {name:'single attorney',mobile:true,featured:'a',count:1,expected:['a']},
 {name:'no spotlight',mobile:true,count:5,expected:['a']},
])test(scenario.name,async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 window.matchMedia=query=>({matches:query.includes('max-width')?scenario.mobile:true,addEventListener(){},removeEventListener(){}});
 globalThis.IntersectionObserver=class{observe(){}disconnect(){}};
 const mod=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('app/DiscoveryCarousels.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 const mocks={'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:({attorney,inactive})=>jsx.jsx('div',{'data-active':!inactive,'data-id':attorney.bar_number})},'./home-image':{homePortrait:()=>({})},'./attorney-photo':{attorneyPhoto:()=>null},'./carousel-swipe':{bindCarouselSwipe:()=>()=>{}}};
 await mod.link(spec=>{const obj=mocks[spec];return new vm.SyntheticModule(Object.keys(obj),function(){for(const key of Object.keys(obj))this.setExport(key,obj[key]);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));const attorneys=['a','b','c','d','e'].slice(0,scenario.count).map(bar_number=>({bar_number}));
 const active=()=>Array.from(document.querySelectorAll('[data-active="true"]'),node=>node.dataset.id);
 try{
 await React.act(async()=>root.render(jsx.jsx(mod.namespace.PopularAttorneys,{attorneys,featuredAttorneyId:scenario.featured,onOpen(){}})));
 assert.deepEqual(active(),scenario.expected);
 if(scenario.mobile&&scenario.featured==='a'&&scenario.count>1){
 await React.act(async()=>document.querySelector('[aria-label="Previous attorney"]').click());assert.deepEqual(active(),['a']);
 await React.act(async()=>document.querySelector('[aria-label="Previous attorney"]').click());assert.deepEqual(active(),['e']);
 await React.act(async()=>document.querySelector('[aria-label="Next attorney"]').click());assert.deepEqual(active(),['a']);
 }
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IntersectionObserver;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
