import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Shortlist treats guest list responses as logged out and refreshes correctly after login and logout',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test'}),keys=['window','document','IS_REACT_ACT_ENVIRONMENT','fetch'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 let signedIn=false;
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async()=>Response.json({signedIn,attorneys:signedIn?[{bar_number:'FL:123'}]:[]})});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const code=ts.transpileModule(fs.readFileSync('app/Shortlist.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);});});await mod.evaluate();
 let state;function Consumer(){state=mod.namespace.useShortlist();return React.createElement(mod.namespace.ShortlistNavLink);}
 const root=createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.ShortlistProvider,null,React.createElement(Consumer))));
  assert.equal(state.loading,false);assert.equal(state.signedIn,false);assert.equal(state.requiresSignIn,true);assert.equal(state.error,'');assert.equal(document.querySelector('a'),null);
  signedIn=true;await React.act(async()=>window.dispatchEvent(new window.Event('client-auth-changed')));assert.equal(state.signedIn,true);assert.equal(state.requiresSignIn,false);assert.equal(state.attorneys.length,1);assert.match(document.querySelector('a').textContent,/Shortlist 1/);
  signedIn=false;await React.act(async()=>window.dispatchEvent(new window.Event('client-auth-changed')));assert.equal(state.signedIn,false);assert.equal(state.attorneys.length,0);assert.equal(document.querySelector('a'),null);
 }finally{await React.act(async()=>root.unmount());dom.window.close();for(const k of keys)Object.defineProperty(globalThis,k,{value:old[k],configurable:true,writable:true});}
});
