import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
for(const mobile of [false,true])test('Carousel retains sizing content while changing '+(mobile?'mobile':'desktop')+' slides',async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 window.matchMedia=q=>({matches:q.includes('reduced-motion')||mobile,addEventListener(){},removeEventListener(){}});
 const {createRoot}=await import('react-dom/client'),attorneys=Array.from({length:8},(_,i)=>({bar_number:String(i),name:'Attorney '+i,languages:i===0?'English, Spanish':''}));
 const deps={react:React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:({attorney,inactive,carouselSlot})=>React.createElement('article',{'data-inactive':String(inactive),'data-slot':carouselSlot},attorney.name)},'./home-image':{homePortrait:()=>({})},'./attorney-photo':{attorneyPhoto:()=>''},'./carousel-swipe':{bindCarouselSwipe:()=>()=>{}}};
 const context=vm.createContext({window,document,IntersectionObserver:class{observe(){}disconnect(){}}}),mod=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('app/DiscoveryCarousels.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{context});await mod.link(name=>{const values=deps[name];assert.ok(values,name);return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});await mod.evaluate();const root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(React.createElement(mod.namespace.PopularAttorneys,{attorneys,onOpen(){}})));const nodes=[...document.querySelectorAll('article')];assert.equal(nodes.length,8);assert.equal(document.querySelectorAll('[data-inactive="false"]').length,mobile?1:4);await React.act(async()=>document.querySelector(mobile?'.mobile-attorney-controls button:last-child':'.carousel-edge-next').click());assert.deepEqual([...document.querySelectorAll('article')],nodes,'Sizing nodes must remain mounted across slides');assert.equal(document.querySelector('[data-inactive="false"]').textContent,'Attorney '+(mobile?1:4));assert.equal(document.querySelectorAll('[data-inactive="false"]').length,mobile?1:4);}finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
