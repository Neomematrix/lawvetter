import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Password previews toggle independently without changing values or submitting',async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const code=ts.transpileModule(fs.readFileSync('app/PasswordInput.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));let submits=0;
 try{
  const Input=mod.namespace.default;
  await React.act(async()=>root.render(React.createElement('form',{onSubmit:e=>{e.preventDefault();submits++;}},React.createElement(Input,{name:'password',defaultValue:'Example-password-123',autoComplete:'current-password',required:true}),React.createElement(Input,{name:'confirm',defaultValue:'Confirm-value',disabled:true}))));
  const [input,confirm]=document.querySelectorAll('input'),[toggle,secondToggle]=document.querySelectorAll('button');assert.equal(input.type,'password');assert.equal(confirm.type,'password');assert.equal(secondToggle.disabled,true);
  await React.act(async()=>toggle.click());assert.equal(input.type,'text');assert.equal(input.value,'Example-password-123');assert.equal(confirm.type,'password');assert.equal(toggle.getAttribute('aria-label'),'Hide password');assert.equal(toggle.getAttribute('aria-pressed'),'true');assert.equal(toggle.getAttribute('aria-controls'),input.id);assert.equal(submits,0);
  assert.equal(new dom.window.FormData(document.querySelector('form')).get('password'),'Example-password-123');assert.equal(input.autocomplete,'current-password');assert.equal(input.required,true);
  await React.act(async()=>toggle.click());assert.equal(input.type,'password');assert.equal(input.value,'Example-password-123');assert.equal(toggle.getAttribute('aria-label'),'Show password');assert.equal(submits,0);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
