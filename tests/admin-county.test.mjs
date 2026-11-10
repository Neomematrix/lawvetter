import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
async function setup(initialCounty=''){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/admin/records'}),keys=['window','document','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');let changeAddress,county=initialCounty;const pending=[];
 const fetch=(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}));
 const context=vm.createContext({fetch,setTimeout,clearTimeout,AbortController}),code=ts.transpileModule(fs.readFileSync('app/admin/records/AdminCountyField.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const exports=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});});await mod.evaluate();
 function Editor(){const [address,setAddress]=React.useState('123 Main St'),[value,setCounty]=React.useState(initialCounty);changeAddress=setAddress;county=value;return React.createElement(mod.namespace.default,{address,city:'The Woodlands',state:'TX',zip:'77380',value,onChange:setCounty});}
 const root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(Editor)));
 return {React,dom,pending,get county(){return county;},async type(value){await React.act(async()=>{const input=document.querySelector('input');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});},async address(value){await React.act(async()=>changeAddress(value));},async wait(){await React.act(async()=>new Promise(resolve=>setTimeout(resolve,650)));},async resolve(index,body,status=200){await React.act(async()=>pending[index].resolve(Response.json(body,{status})));},async close(){await React.act(async()=>root.unmount());dom.window.close();for(const key of keys)Object.defineProperty(globalThis,key,{value:old[key],writable:true,configurable:true});}};
}
test('admin County fills from the complete address and changes when the address changes',async()=>{const s=await setup();try{
 await s.wait();assert.equal(s.pending.length,1);assert.equal(s.pending[0].url,'/api/address-county');assert.equal(JSON.parse(s.pending[0].options.body).zip,'77380');await s.resolve(0,{county:'Montgomery County'});assert.equal(s.county,'Montgomery County');assert.match(document.querySelector('[role=status]').textContent,/filled from the address/);
 await s.address('200 New Street');assert.equal(s.county,'');await s.wait();await s.resolve(1,{county:'Harris County'});assert.equal(s.county,'Harris County');
 }finally{await s.close();}});
test('admin County keeps manual corrections, ignores stale responses and offers manual entry on lookup failure',async()=>{const s=await setup();try{
 await s.wait();await s.type('Corrected County');await s.resolve(0,{county:'Old County'});assert.equal(s.county,'Corrected County');
 await s.address('300 Another Street');await s.wait();await s.address('400 Current Street');await s.wait();assert.equal(s.pending[1].options.signal.aborted,true);await s.resolve(1,{county:'Stale County'});assert.equal(s.county,'');await s.resolve(2,{county:null});assert.match(document.querySelector('[role=status]').textContent,/No exact address match/);await s.type('Manual County');assert.equal(s.county,'Manual County');
 }finally{await s.close();}});
test('opening an existing attorney preserves its saved county until the address is changed',async()=>{const s=await setup('Saved County');try{await s.wait();assert.equal(s.pending.length,0);assert.equal(s.county,'Saved County');await s.address('500 Changed Street');assert.equal(s.county,'');await s.wait();await s.resolve(0,{error:'Unavailable'},503);assert.match(document.querySelector('[role=status]').textContent,/unavailable/);assert.equal(s.county,'');}finally{await s.close();}});
