import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Enter dismisses suggestions without selecting a random result; typing reopens them in the selected category',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');let selected=null,changeKind;const calls=[];
 const fetch=async url=>{calls.push(url);return Response.json({attorneys:[{bar_number:'1',name:'Jack Kerdasha',city:'Atlanta',state:'GA'}],firms:[{firm_key:'jackfirm',name:'Jack Firm',attorneys:2}]});};
 const context=vm.createContext({console,fetch,URLSearchParams,AbortController,setTimeout,clearTimeout});
 const code=ts.transpileModule(fs.readFileSync('app/AttorneyNameInput.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const v=spec==='react'?React:spec==='react/jsx-runtime'?jsx:{searchPracticeArea:()=>null};return new vm.SyntheticModule(Object.keys(v),function(){for(const k of Object.keys(v))this.setExport(k,v[k]);},{context});});await mod.evaluate();
 function Harness(){const [value,setValue]=React.useState('jack'),[kind,setKind]=React.useState('attorneys');changeKind=setKind;return React.createElement(mod.namespace.default,{value,kind,city:'',enabled:true,onChange:setValue,onSelect:x=>selected=x,onSelectFirm:x=>selected=x});}
 const root=createRoot(document.getElementById('root')),settle=()=>React.act(async()=>new Promise(r=>setTimeout(r,250)));
 try{
  await React.act(async()=>root.render(React.createElement(Harness)));const input=document.querySelector('input');await React.act(async()=>input.focus());await settle();
  assert.equal(input.getAttribute('aria-expanded'),'true');assert.match(calls.at(-1),/kind=attorneys/);assert.equal(document.querySelectorAll('[role=option]').length,1);
  const enter=new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});await React.act(async()=>input.dispatchEvent(enter));assert.equal(enter.defaultPrevented,false);assert.equal(selected,null);assert.equal(input.getAttribute('aria-expanded'),'false');assert.equal(document.querySelector('[role=listbox]'),null);await settle();assert.equal(document.querySelector('[role=listbox]'),null);
  const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;await React.act(async()=>{setter.call(input,'jack k');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await settle();assert.equal(input.getAttribute('aria-expanded'),'true');
  await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));const choose=new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});await React.act(async()=>input.dispatchEvent(choose));assert.equal(choose.defaultPrevented,true);assert.equal(selected.name,'Jack Kerdasha');assert.equal(input.getAttribute('aria-expanded'),'false');
  await React.act(async()=>{changeKind('firms');setter.call(input,'jack firm');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await settle();assert.match(calls.at(-1),/kind=firms/);assert.equal(document.querySelector('[role=option] strong').textContent,'Jack Firm');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
