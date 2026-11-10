import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Attorney inbox has a share action, empty state, message filters and working follow-up controls',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/account'});
 const keys=['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 let copied='',shared=0;Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{copied=value;}},configurable:true});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 let referrals=[];const calls=[],previousFetch=globalThis.fetch;globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){const payload=JSON.parse(options.body);calls.push(payload);referrals=referrals.map(row=>row.id===payload.id?{...row,...(payload.action==='read'?{attorney_read_at:'today'}:{}),...(payload.action==='status'?{status:payload.status}:{})}:row);return Response.json({saved:true});}return Response.json({referrals,metrics:{total:referrals.length,unread:referrals.filter(r=>!r.attorney_read_at).length,urgent:0},page:1});};
 const code=ts.transpileModule(fs.readFileSync('app/account/AttorneyReferrals.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:{referralUrgencyLabel:()=> 'No immediate deadline'};return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root')),button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.includes(text)),metrics=()=>{};
 try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.default,{bar:'FL:123',name:'Example Lawyer',onMetrics:metrics})));
  assert.match(document.body.textContent,/No messages yet/);assert.equal(document.querySelector('input[readonly]'),null,'Raw URL is hidden by default');
  await React.act(async()=>button('Share referral link').click());assert.equal(copied,'https://lawvetter.test/hire-lawyer?attorney=FL%3A123');assert.match(document.body.textContent,/Ready to share/);
  Object.defineProperty(navigator,'share',{value:async payload=>{shared++;assert.equal(payload.url,copied);},configurable:true});await React.act(async()=>button('Share referral link').click());assert.equal(shared,1);
  const base={email:'client@example.test',phone:'5551234567',city:'Miami',practice:'Family law',contact_method:'email',urgency:'none',status:'new',created_at:'2026-10-27T12:00:00Z',email_alert_status:'accepted'};
  referrals=[{...base,id:'1',name:'First Client',summary:'First client message',attorney_read_at:null},{...base,id:'2',name:'Second Client',summary:'Second client message',attorney_read_at:'yesterday'}];
  await React.act(async()=>button('Refresh').click());assert.equal(document.querySelectorAll('.mailbox-message-row').length,2);
  await React.act(async()=>button('Unread').click());assert.equal(document.querySelectorAll('.mailbox-message-row').length,1);
  await React.act(async()=>button('Inbox').click());await React.act(async()=>button('Second Client').click());assert.match(document.querySelector('.mailbox-reader').textContent,/Second client message/);
  await React.act(async()=>{const select=document.querySelector('.mailbox-reader select');select.value='contacted';select.dispatchEvent(new window.Event('change',{bubbles:true}));});assert.ok(calls.some(call=>call.id==='2'&&call.status==='contacted'));
  await React.act(async()=>button('First Client').click());assert.ok(calls.some(call=>call.id==='1'&&call.action==='read'));
 }finally{await React.act(async()=>root.unmount());globalThis.fetch=previousFetch;dom.window.close();for(const key of keys)Object.defineProperty(globalThis,key,{value:old[key],configurable:true,writable:true});}
});
