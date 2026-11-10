import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

for(const compact of [false,true])test((compact?'Compact admin upload':'Full upload')+' loads the saved image and restores it after cancelling a replacement',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const context=vm.createContext({URL,console,Uint8Array});
 const source=ts.transpileModule(fs.readFileSync('app/admin/records/FirmImageUpload.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(source,{context});
 await mod.link(async spec=>{if(spec==='../../firm-banner'){const child=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('app/firm-banner.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,{context});await child.link(()=>{});return child;}const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:{firmKey:name=>name.toLowerCase().replaceAll(' ','')};return new vm.SyntheticModule(Object.keys(values),function(){for(const k of Object.keys(values))this.setExport(k,values[k]);},{context});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));let setFile;
 function Harness(){const [file,set]=React.useState(null);setFile=set;return React.createElement(mod.namespace.default,{compact,name:'Example Firm',file,onChange:set,disabled:false});}
 try{
  await React.act(async()=>root.render(React.createElement(Harness)));
  let image=document.querySelector('.admin-firm-banner-preview img');const savedSrc=image.getAttribute('src');
  assert.match(savedSrc,/key=examplefirm&preview=\d+/);assert.notEqual(image.style.visibility,'hidden');
  Object.defineProperty(image,'naturalWidth',{value:500});Object.defineProperty(image,'naturalHeight',{value:70});
  await React.act(async()=>image.dispatchEvent(new dom.window.Event('load')));
  assert.doesNotMatch(document.body.textContent,/Original image|Recommended size|Firm page banner preview|without cropping/);assert.match(document.body.textContent,/Upload image/);if(!compact)assert.match(document.body.textContent,/Optional/);assert.equal(document.querySelector('.firm-banner-preview-placeholder'),null);
  const picker=document.querySelector('input[type=file]');Object.defineProperty(picker,'files',{value:[new File([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,6,64,0,0,2,21,...Array(9).fill(0)])],'replacement.png',{type:'image/png'})],configurable:true});await React.act(async()=>picker.dispatchEvent(new dom.window.Event('change',{bubbles:true})));if(compact)assert.match(document.body.textContent,/Change image/);
  image=document.querySelector('.admin-firm-banner-preview img');assert.match(image.getAttribute('src'),/^blob:/);
  await React.act(async()=>image.dispatchEvent(new dom.window.Event('error')));assert.match(document.querySelector('[role=alert]').textContent,/could not be previewed/);
  await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel firm image change'||b.getAttribute('aria-label')==='Cancel firm image change').click());
  assert.equal(document.querySelector('.admin-firm-banner-preview img').getAttribute('src'),savedSrc);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
