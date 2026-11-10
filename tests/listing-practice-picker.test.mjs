import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
test('Public practice picker requires an option, supports multiple selections and blocks arbitrary text',async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const oldFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({areas:[{name:'Existing custom category'}]});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');const choices=[{id:'family-law',name:'Family law'},{id:'business-law',name:'Business law'}];
 const code=ts.transpileModule(fs.readFileSync('app/add-listing/ListingPracticePicker.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:{practiceAreaChoices:()=>choices,splitPracticeAreas:v=>v.split(',').map(x=>x.trim()).filter(Boolean),categoryList:values=>[...new Set(values)].map(name=>({id:name,name}))};return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);});});await mod.evaluate();
 function Form(){const[value,setValue]=React.useState('');return React.createElement('form',null,React.createElement(mod.namespace.default,{value,onChange:setValue}));}const root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(React.createElement(Form)));const select=document.querySelector('select');assert.equal(select.required,true);assert.equal(document.querySelector('form').checkValidity(),false);assert.ok([...select.options].some(x=>x.value==='Existing custom category'));assert.equal(document.querySelector('input[type="text"]'),null);
 async function choose(name){await React.act(async()=>{select.value=name;select.dispatchEvent(new window.Event('change',{bubbles:true}));});}
 await choose('Family law');assert.equal(select.required,false);assert.equal(document.querySelector('form').checkValidity(),true);await choose('Business law');assert.equal(document.querySelector('[name="practiceAreas"]').value,'Family law, Business law');assert.ok(![...select.options].some(x=>x.value==='Family law'));
 for(const name of ['Family law','Business law'])await React.act(async()=>document.querySelector('[aria-label="Remove '+name+'"]').click());assert.equal(select.required,true);assert.equal(document.querySelector('form').checkValidity(),false);
 }finally{await React.act(async()=>root.unmount());globalThis.fetch=oldFetch;dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
