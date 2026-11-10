import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
test('additional office controls reveal successive locations, retain input and remove an office',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/admin/records'}),keys=['window','document','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const context=vm.createContext({console,window:dom.window,document:dom.window.document,setTimeout,clearTimeout,AbortController,URLSearchParams,fetch:async()=>Response.json({cities:[]})}),modules=new Map();
 function module(file){if(modules.has(file))return modules.get(file);const actual=['.tsx','.ts'].map(ext=>file+ext).find(fs.existsSync),code=ts.transpileModule(fs.readFileSync(actual,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod=new vm.SourceTextModule(code,{context,identifier:actual});modules.set(file,mod);return mod;}
 const mod=module(path.resolve('app/admin/records/FirmLocationsEditor'));await mod.link((spec,parent)=>{if(spec.startsWith('.'))return module(path.resolve(path.dirname(parent.identifier),spec));const exports=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});});await mod.evaluate();
 let saved='[]';function Editor(){const [value,setValue]=React.useState(saved);return React.createElement(mod.namespace.default,{value,onChange:v=>{saved=v;setValue(v);}});}
 const root=createRoot(document.getElementById('root')),button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(label));
 try{
 await React.act(async()=>root.render(React.createElement(Editor)));assert.equal(document.querySelectorAll('fieldset').length,0);assert.ok(button('Add second location'));
 await React.act(async()=>button('Add second location').click());assert.equal(document.querySelectorAll('fieldset').length,1);assert.ok(button('Add third location'));
 const street=document.querySelector('fieldset input'),setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;await React.act(async()=>{setter.call(street,'200 Second Street');street.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});assert.equal(JSON.parse(saved)[0].address,'200 Second Street');
 await React.act(async()=>button('Add third location').click());assert.equal(document.querySelectorAll('fieldset').length,2);assert.ok(button('Add fourth location'));assert.equal(document.querySelector('fieldset input').value,'200 Second Street');
 await React.act(async()=>button('Remove location 3').click());assert.equal(document.querySelectorAll('fieldset').length,1);assert.equal(JSON.parse(saved)[0].address,'200 Second Street');
 await React.act(async()=>root.render(React.createElement(mod.namespace.default,{value:saved,onChange:()=>{},disabled:true})));assert.equal(button('Add third location').disabled,true);assert.equal(document.querySelector('fieldset').disabled,true);
 }finally{await React.act(async()=>root.unmount());dom.window.close();for(const key of keys)Object.defineProperty(globalThis,key,{value:old[key],writable:true,configurable:true});}
});
