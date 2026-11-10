import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
test('assignment requires account selection and verification, then displays the linked account',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/admin/records'}),previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client'),sent=[];
 const attorney={bar_number:'1001',name:'Attorney One',company:'Firm',state:'GA',owner_id:null},user={user_id:'one',legal_name:'User One',email:'one@example.test',fingerprint:'preview-hash'};
 const context=vm.createContext({console,URLSearchParams,AbortController,fetch:async(url,options)=>{if(options?.method==='POST'){sent.push(JSON.parse(options.body));return Response.json({linked:true});}return Response.json({attorney,users:url.includes('&q=')?[user]:[]});}});
 const code=ts.transpileModule(fs.readFileSync('app/admin/records/AssignAttorneyAccess.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const exports=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v);},{context});});await mod.evaluate();const root=createRoot(document.getElementById('root'));let linked=0;
 try{await React.act(async()=>root.render(React.createElement(mod.namespace.default,{bar:'1001',onClose(){},onLinked(){linked++;}})));
 assert.match(document.body.textContent,/Attorney One/);
 await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 await React.act(async()=>document.querySelector('input[type=radio]').click());
 const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Link account');assert.equal(button.disabled,true);await React.act(async()=>button.click());assert.equal(sent.length,0);
 await React.act(async()=>document.querySelector('input[type=checkbox]').click());assert.equal(button.disabled,false);await React.act(async()=>button.click());
 assert.deepEqual(sent[0],{bar:'1001',userId:'one',fingerprint:'preview-hash',verified:true});assert.equal(linked,1);assert.match(document.body.textContent,/Account linked/);assert.match(document.body.textContent,/one@example.test/);
 const firmButton=[...document.querySelectorAll('button')].find(b=>b.textContent==='Assign firm administrator');assert.ok(firmButton);assert.equal(firmButton.disabled,true);await React.act(async()=>firmButton.click());assert.equal(sent.length,1);
 await React.act(async()=>document.querySelector('.admin-access-firm input[type=checkbox]').click());await React.act(async()=>firmButton.click());assert.deepEqual(sent[1],{action:'grant',firm:'Firm',email:'one@example.test',verified:true});assert.match(document.body.textContent,/Firm administrator assigned/);
 attorney.owner_id='one';attorney.owner_email=user.email;attorney.owner_name=user.legal_name;
 await React.act(async()=>root.render(React.createElement(mod.namespace.default,{key:'existing',bar:'1001',onClose(){},onLinked(){}})));
 assert.match(document.body.textContent,/This profile is already linked/);assert.equal(document.querySelector('input[type=search]'),null);
 const existingButton=[...document.querySelectorAll('button')].find(b=>b.textContent==='Assign firm administrator');assert.equal(existingButton.disabled,true);
 await React.act(async()=>document.querySelector('.admin-access-firm input[type=checkbox]').click());await React.act(async()=>existingButton.click());assert.deepEqual(sent[2],{action:'grant',firm:'Firm',email:'one@example.test',verified:true});
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,previous);}
});
