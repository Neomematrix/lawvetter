import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Header destinations support native new-tab gestures while ordinary clicks retain client navigation',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const context=vm.createContext({window:dom.window});
 const code=ts.transpileModule(fs.readFileSync('app/ResponsiveHeader.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const deps={react:React,'react/jsx-runtime':jsx,'./ClientAccountNav':{default:()=>null},'./Shortlist':{useShortlist:()=>({signedIn:true,attorneys:[{},{}]})}};
 const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const values=deps[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});await mod.evaluate();
 const root=createRoot(document.getElementById('root')),navigations=[],defaults=[];
 const observe=event=>{defaults.push(event.defaultPrevented);event.preventDefault();};document.addEventListener('click',observe);document.addEventListener('auxclick',observe);
 try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.default,{activeView:'charts',onNavigate:view=>navigations.push(view)})));
  for(const [selector,href,view]of [['a.brand','/','discover'],['nav a[href="/?view=charts"]','/?view=charts','charts'],['a.shortlist-nav','/?view=shortlist','shortlist']]){
   const link=document.querySelector(selector);assert.equal(link.tagName,'A');assert.equal(link.getAttribute('href'),href);
   const before=navigations.length;await React.act(async()=>link.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
   assert.equal(navigations.length,before+1);assert.equal(navigations.at(-1),view);assert.equal(defaults.at(-1),true);
   for(const gesture of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]){
    const count=navigations.length;await React.act(async()=>link.dispatchEvent(new dom.window.MouseEvent(gesture.button===1?'auxclick':'click',{bubbles:true,cancelable:true,button:0,...gesture})));
    assert.equal(navigations.length,count,'Modified clicks must be left to the browser');assert.equal(defaults.at(-1),false);
   }
  }
  assert.equal(document.querySelector('nav a[href="/?view=charts"]').getAttribute('aria-current'),'page');
  for(const href of ['/','/discover','/client-reviews'])assert.ok(document.querySelector('nav a[href="'+href+'"]'));
  await React.act(async()=>root.render(React.createElement(mod.namespace.default,{})));
  await React.act(async()=>document.querySelector('nav a[href="/?view=charts"]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
  assert.equal(defaults.at(-1),false,'Pages without a client navigation callback retain ordinary link navigation');
 }finally{document.removeEventListener('click',observe);document.removeEventListener('auxclick',observe);await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
