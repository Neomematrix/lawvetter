import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('admin account picker opens the chosen account; banner identifies the user and returns to admin',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test'}),keys=['window','document','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');let destination='',requests=[];
 const fetch=async(url,options)=>{if(options?.method==='POST'){const body=JSON.parse(options.body);requests.push(body);return Response.json({redirect:body.action==='start'?'/account':'/admin/view-as'});}if(url.includes('status=1'))return Response.json({active:true,user:{name:'Attorney One',email:'lawyer@example.com'}});return Response.json({users:[{user_id:'lawyer',legal_name:'Attorney One',email:'lawyer@example.com',role:'Attorney'},{user_id:'client',legal_name:'Client One',email:'client@example.com',role:'Client'}],total:2});};
 const fakeWindow={location:{assign:url=>destination=url},addEventListener(){},removeEventListener(){}};
 async function component(file){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const context=vm.createContext({window:fakeWindow,fetch,setTimeout,clearTimeout,setInterval,clearInterval,URLSearchParams,AbortController});const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const exports=spec==='react'?React:spec==='react/jsx-runtime'?jsx:{usePathname:()=>'/account'};return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});});await mod.evaluate();return mod.namespace.default;}
 const Picker=await component('app/admin/view-as/page.tsx'),Banner=await component('app/ViewAsBanner.tsx'),root=createRoot(document.getElementById('root'));
 try{
 await React.act(async()=>root.render(React.createElement(Picker)));await React.act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
 assert.match(document.body.textContent,/Attorney One/);assert.match(document.body.textContent,/Client One/);assert.match(document.body.textContent,/Actions you take save/);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='View as user').click());assert.equal(requests[0].userId,'lawyer');assert.equal(destination,'/account');
 await React.act(async()=>root.render(React.createElement(Banner)));assert.match(document.body.textContent,/Viewing as Attorney One/);assert.match(document.body.textContent,/lawyer@example.com/);
 await React.act(async()=>document.querySelector('button').click());assert.equal(requests.at(-1).action,'stop');assert.equal(destination,'/admin/view-as');
 }finally{await React.act(async()=>root.unmount());dom.window.close();for(const key of keys)Object.defineProperty(globalThis,key,{value:old[key],writable:true,configurable:true});}
});
