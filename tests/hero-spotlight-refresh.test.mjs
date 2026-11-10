import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Hero leader refreshes from cached public rankings, pauses in background, and retains the last good leader on failures',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(document,'visibilityState',{value:'visible',writable:true,configurable:true});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const rankings=name=>({monthly:[{name,bar_number:name,rank:1}],monthLabel:'November 2026'});
 let clock=0,tick,intervalCleared=false,next=rankings('Second Leader'),failure=false,pendingResolve;
 const calls=[],timeouts=new Map();let timeoutId=0;
 const context=vm.createContext({document,window:dom.window,Date:{now:()=>clock},AbortController,
  setInterval:(fn,delay)=>{assert.equal(delay,120000);tick=fn;return 1;},clearInterval:()=>{intervalCleared=true;},
  setTimeout:(fn,delay)=>{assert.equal(delay,10000);timeouts.set(++timeoutId,fn);return timeoutId;},clearTimeout:id=>timeouts.delete(id),
  fetch:async(url,options)=>{calls.push({url,options});if(failure)throw Error('Temporary failure');if(next==='pending')return new Promise(resolve=>{pendingResolve=resolve;});return Response.json(next);}
 });
 const code=ts.transpileModule(fs.readFileSync('app/HeroMonthlySpotlight.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const deps={react:React,'react/jsx-runtime':jsx,'./MonthlySpotlight':{default:({data,variant})=>React.createElement('section',{'data-variant':variant},data.monthly[0].name)},'./HeroSpotlightState':{default:()=>React.createElement('p',null,'Rankings pending')}};
 const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const values=deps[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});await mod.evaluate();
 const initial=rankings('First Leader');
 function Harness(){const [data,setData]=React.useState(null);return React.createElement(mod.namespace.default,{initialData:initial,data,onData:setData,onOpen:()=>{}});}
 const root=createRoot(document.getElementById('root'));let mounted=true;
 const refresh=async()=>{clock+=120000;await React.act(async()=>{tick();});};
 try{
  await React.act(async()=>root.render(React.createElement(Harness)));assert.match(document.body.textContent,/First Leader/);assert.equal(calls.length,0,'Server-provided rankings avoid a duplicate initial request');
  await refresh();assert.match(document.body.textContent,/Second Leader/);assert.equal(document.querySelector('[data-variant]').dataset.variant,'hero');assert.equal(calls[0].url,'/api/attorneys?home=1');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.body,undefined);
  document.visibilityState='hidden';next=rankings('Third Leader');await refresh();assert.equal(calls.length,1,'Hidden pages do not poll rankings');
  document.visibilityState='visible';await React.act(async()=>document.dispatchEvent(new dom.window.Event('visibilitychange')));assert.match(document.body.textContent,/Third Leader/);assert.equal(calls.length,2);
  failure=true;await refresh();assert.match(document.body.textContent,/Third Leader/);assert.equal(calls.length,3);
  failure=false;next={monthly:[],monthLabel:'December 2026'};await refresh();assert.match(document.body.textContent,/Rankings pending/,'A new month without a leader does not keep the old winner');
  next='pending';await refresh();const count=calls.length;clock+=120000;await React.act(async()=>tick());assert.equal(calls.length,count,'Ranking requests cannot overlap');
  await React.act(async()=>root.unmount());mounted=false;assert.equal(intervalCleared,true);assert.equal(calls.at(-1).options.signal.aborted,true);assert.equal(timeouts.size,0);
  pendingResolve(Response.json(rankings('Late Leader')));
 }finally{if(mounted)await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
