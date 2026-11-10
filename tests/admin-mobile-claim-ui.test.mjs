import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
test('unconfirmed claim explains the block and requires explicit manual verification before granting the exact account',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/admin/firm-claims'}),previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client'),sent=[];
 const claim={id:'claim',firm_name:'Thrift McLemore',firm_key:'thriftmclemore',legal_name:'Craig Thrift',account_email:'thriftmclemore@gmail.com',firm_email:'media@thriftlegal.com',authority:'Co-founder',status:'pending',submitted_at:'2026-10-31T16:05:38Z',firm_email_verified_at:null};
 const context=vm.createContext({console,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{if(options?.method==='POST'){sent.push(JSON.parse(options.body));return Response.json({approved:true});}return Response.json({claims:[claim],total:1});}});
 const code=ts.transpileModule(fs.readFileSync('app/admin/firm-claims/page.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module=new vm.SourceTextModule(code,{context});await module.link(spec=>{const exports=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v);},{context});});await module.evaluate();const root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(React.createElement(module.namespace.default)));await React.act(async()=>new Promise(resolve=>setTimeout(resolve,260)));const card=document.querySelector('article');await React.act(async()=>card.querySelector('button').click());assert.match(card.textContent,/Confirming a matching firm email automatically grants access/);const button=[...card.querySelectorAll('button')].find(b=>b.textContent==='Manually verify and approve');assert.equal(button.disabled,true);await React.act(async()=>button.click());assert.equal(sent.length,0);await React.act(async()=>card.querySelector('.admin-manual-verification input').click());assert.equal(button.disabled,false);await React.act(async()=>button.click());assert.equal(sent[0].action,'grant');assert.equal(sent[0].email,claim.account_email);assert.equal(sent[0].firm,claim.firm_name);assert.equal(sent[0].verified,true);}finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,previous);}
});
