import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Homepage suggests partial and complete practice names locally and preserves attorney autocomplete',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const calls=[],picked=[];
 const context=vm.createContext({console,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async url=>{calls.push(url);return Response.json({attorneys:new URLSearchParams(url.split('?')[1]).get('q')==='Alex'?[{bar_number:'1',name:'Alex Smith',city:'Atlanta',state:'GA'}]:[]});}});
 const code=ts.transpileModule(fs.readFileSync('app/AttorneyNameInput.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:{searchPracticeArea:value=>value.toLowerCase()==='personal injury'?{id:'personal-injury'}:null};return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});await mod.evaluate();
 const practices=[{id:'personal-injury',name:'Personal injury',description:'Injuries, accidents & liability'},{id:'family-law',name:'Family law',description:'Divorce, custody & family matters'},{id:'tax',name:'Tax',description:'Tax advice and representation'}];
 function Harness(){const [value,setValue]=React.useState('personal');return React.createElement(mod.namespace.default,{value,city:'Atlanta',enabled:true,practices,onChange:setValue,onSelect:attorney=>picked.push(attorney),emptyMessage:'No matching attorneys or practice areas.'});}
 const root=createRoot(document.getElementById('root')),settle=()=>React.act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
 try{
  await React.act(async()=>root.render(React.createElement(Harness)));const input=document.querySelector('input');await React.act(async()=>input.focus());await settle();
  assert.match(document.querySelector('[role=option]').textContent,/Personal injuryPractice area/);assert.equal(document.querySelector('[role=status]'),null);assert.equal(calls.length,1,'Partial input retains the existing name lookup alongside local practice suggestions');
  await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
  const enter=new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});await React.act(async()=>input.dispatchEvent(enter));assert.equal(enter.defaultPrevented,true);assert.equal(input.value,'Personal injury');assert.equal(document.querySelector('[role=listbox]'),null);assert.equal(picked.length,0,'Choosing a practice fills the field rather than opening an attorney');
  await React.act(async()=>{input.blur();input.focus();});assert.match(document.querySelector('[role=option]').textContent,/Personal injury/,'The complete practice name also has a suggestion');
  const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
  async function type(value){await React.act(async()=>{setter.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await settle();}
  await type('custody');assert.match(document.querySelector('[role=option]').textContent,/Family law/);
  const beforeTax=calls.length;await type('Tax');assert.match(document.querySelector('[role=option]').textContent,/TaxPractice area/,'Additional categories supplied by the directory are included');await React.act(async()=>document.querySelector('[role=option]').click());assert.equal(input.value,'Tax');assert.equal(calls.length,beforeTax,'An exact practice name does not trigger an unnecessary name lookup');
  await type('Alex');assert.equal(calls.length,beforeTax+1);assert.match(calls.at(-1),/city=Atlanta/);assert.match(document.querySelector('[role=option]').textContent,/Alex Smith/);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
