import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import {gzipSync} from 'node:zlib';

function load(file,extra={}){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,URL,URLSearchParams,Request,Response,Headers,console,...extra});
 return exports;
}
const critical=JSON.parse(fs.readFileSync('worker/landing-critical.json','utf8'));
function landing(){
 let callback;
 class Rewriter{on(selector,handler){assert.equal(selector,'link[rel="stylesheet"]');callback=handler.element;return this;}transform(response){return new Response(response.body,response);}}
 const mod=load('worker/landing-performance.ts',{HTMLRewriter:Rewriter,require:()=>critical});
 return {...mod,rewrite(href){const attrs=new Map([['href',href],['rel','stylesheet']]),before=[];callback({getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),before:v=>before.push(v)});return {attrs,before};}};
}
test('Only homepage and Charts HTML receive initial CSS; Discover, RSC and APIs retain their original response',()=>{
 const m=landing();
 for(const path of ['/','/?view=charts','/?view=charts&period=monthly'])assert.equal(m.isLandingDocument(new Request('https://lawvetter.test'+path)),true);
 for(const path of ['/discover','/?view=discover','/?view=shortlist','/api/attorneys','/?_rsc=1'])assert.equal(m.isLandingDocument(new Request('https://lawvetter.test'+path)),false);
 for(const headers of [{RSC:'1'},{'next-router-state-tree':'x'},{Accept:'text/x-component'}])assert.equal(m.isLandingDocument(new Request('https://lawvetter.test/',{headers})),false);
 for(const path of ['/discover','/account','/?view=shortlist']){const response=new Response('original',{headers:{'Content-Type':'text/html'}});assert.equal(m.landingPerformanceResponse(new Request('https://lawvetter.test'+path),response),response);}
});
test('Initial styles precede deferred originals, preserve URLs and include the no-JavaScript fallback',()=>{
 const m=landing();m.landingPerformanceResponse(new Request('https://lawvetter.test/'),new Response('html',{headers:{'Content-Type':'text/html'}}));
 const href='/api/lv-assets-123/index-abcdef.css';const first=m.rewrite(href);
 assert.match(first.before[0],/^<style data-lawvetter-critical>/);assert.match(first.before[0],/landing-hero-copy/);assert.match(first.before[0],/chart-halo-banner/);assert.match(first.before[0],/mobile-menu-toggle/);
 assert.equal(first.attrs.get('href'),href);assert.equal(first.attrs.get('media'),'print');assert.equal(first.attrs.get('fetchpriority'),'low');
 assert.match(first.before[1],/<noscript><link rel="stylesheet"/);
 const element={media:'print',onload:()=>{}};vm.runInNewContext(first.attrs.get('onload'),element);assert.equal(element.media,'all');assert.equal(element.onload,null);
 const second=m.rewrite('/api/lv-assets-123/Charts-abcdef.css');assert.equal(second.before.length,1);
 const other=m.rewrite('/other.css');assert.equal(other.attrs.has('media'),false);
 assert.ok(gzipSync(critical.css).length<32000);assert.doesNotMatch(critical.css,/<\/style/i);
});

function analytics(path,privacy=false){
 const mod=load('app/GoogleAnalytics.tsx',{process:{env:{}},require:()=>({jsx:(_,props)=>props})});
 const code=mod.default({measurementId:'G-ABCDE12345'}).dangerouslySetInnerHTML.__html;
 const dom=new JSDOM('<head></head>',{url:'https://lawvetter.test'+path,runScripts:'outside-only'});
 if(privacy)Object.defineProperty(dom.window.navigator,'doNotTrack',{value:'1'});
 dom.window.eval(code);return dom;
}
test('Analytics loads once, queues page views immediately and retains privacy filtering',()=>{
 for(const path of ['/','/?view=charts']){
  const dom=analytics(path);try{
   const w=dom.window;assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length,1);
   assert.equal(w.dataLayer.filter(args=>args[1]==='page_view').length,1);
   w.gtag('event','generate_lead',{event_id:'example'});
   w.dispatchEvent(new w.Event('pointerdown'));w.dispatchEvent(new w.Event('keydown'));
   assert.equal(w.document.querySelectorAll('script[src*="googletagmanager"]').length,1);
   assert.equal(w.dataLayer.filter(args=>args[1]==='generate_lead').length,1);
  }finally{dom.window.close();}
 }
 const discover=analytics('/discover');try{assert.equal(discover.window.document.querySelectorAll('script[src*="googletagmanager"]').length,1);}finally{discover.window.close();}
 const privateVisit=analytics('/',true);try{privateVisit.window.dispatchEvent(new privateVisit.window.Event('pointerdown'));assert.equal(privateVisit.window.document.querySelectorAll('script[src*="googletagmanager"]').length,0);assert.equal(privateVisit.window.dataLayer,undefined);}finally{privateVisit.window.close();}
});

test('Analytics interaction tracking loads once alongside the analytics library',()=>{
 const dom=analytics('/');try{assert.equal(dom.window.document.querySelectorAll('script[src="/analytics-events-v1.js"]').length,1);dom.window.dispatchEvent(new dom.window.Event('load'));dom.window.dispatchEvent(new dom.window.Event('pointerdown'));assert.equal(dom.window.document.querySelectorAll('script[src]').length,2);}finally{dom.window.close();}
});
