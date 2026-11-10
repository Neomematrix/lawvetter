import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('suggestion scrollbar retains focus and keyboard navigation reveals lower firms',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const code=ts.transpileModule(fs.readFileSync('app/LocationAutocomplete.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root')),chosen=[],scrolled=[];
 dom.window.HTMLElement.prototype.scrollIntoView=function(){scrolled.push(this.textContent);};
 try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.default,{label:'Law firm',value:'Morgan',onChange:v=>chosen.push(v),options:Array.from({length:12},(_,i)=>'Morgan '+i),placeholder:'Firm',minLength:0,maxLength:200,hint:'Choose'})));
  const input=document.querySelector('input');await React.act(async()=>input.focus());
  const list=document.querySelector('[role=listbox]');assert.ok(list);
  const down=new dom.window.MouseEvent('mousedown',{bubbles:true,cancelable:true});list.dispatchEvent(down);assert.equal(down.defaultPrevented,false,'Native scrollbar dragging must not be canceled');await React.act(async()=>list.focus());assert.ok(document.querySelector('[role=listbox]'),'Scrollbar focus must keep suggestions open');await React.act(async()=>input.focus());
  for(let i=0;i<12;i++)await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
  assert.equal(scrolled.at(-1),'Morgan 11');
  await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  assert.deepEqual(chosen,['Morgan 11']);assert.equal(document.querySelector('[role=listbox]'),null);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
