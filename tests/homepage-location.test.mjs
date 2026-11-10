import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Homepage cities populate with state, support keyboard selection, and keep ZIP entry independent',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const calls=[];let fail=false;
 const context=vm.createContext({document:dom.window.document,console,setTimeout,clearTimeout,AbortController,fetch:async(url)=>{calls.push(url);if(fail)throw Error('offline');return Response.json({locations:[{label:'Atlanta, GA'},{label:'Atlanta, IL'}]});}});
 async function component(file,deps){
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const values=deps[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});await mod.evaluate();return mod.namespace;
 }
 const location=await component('app/LocationAutocomplete.tsx',{react:React,'react/jsx-runtime':jsx});
 const homepage=await component('app/HomepageLocationInput.tsx',{react:React,'react/jsx-runtime':jsx,'./LocationAutocomplete':location});
 function Harness(){const [value,setValue]=React.useState('');return React.createElement(homepage.default,{value,onChange:setValue});}
 const root=createRoot(document.getElementById('root')),settle=()=>React.act(async()=>new Promise(resolve=>setTimeout(resolve,220)));
 dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
 try{
  await React.act(async()=>root.render(React.createElement(Harness)));
  const input=document.querySelector('input'),setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
  async function type(value){await React.act(async()=>{input.focus();setter.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await settle();}
  await type('Atl');assert.equal(calls.length,1);assert.match(calls[0],/\/api\/cities\?format=locations&q=Atl/);
  assert.equal(document.querySelectorAll('[role=option]').length,2);
  assert.equal(input.getAttribute('aria-expanded'),'true');
  await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
  const enter=new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});await React.act(async()=>input.dispatchEvent(enter));
  assert.equal(enter.defaultPrevented,true);assert.equal(input.value,'Atlanta, GA');assert.equal(input.getAttribute('aria-expanded'),'false');
  const beforeZip=calls.length;await type('30114');assert.equal(calls.length,beforeZip,'ZIP codes do not trigger city or attorney queries');assert.equal(input.checkValidity(),true);assert.equal(document.querySelector('[role=listbox]'),null);
  await type('301');assert.equal(input.checkValidity(),false,'Incomplete ZIP codes cannot submit');
  fail=true;await type('Miami');assert.match(document.body.textContent,/City suggestions are unavailable/);assert.equal(input.value,'Miami');assert.equal(input.checkValidity(),true,'Manual city entry still works after a failed suggestion request');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
