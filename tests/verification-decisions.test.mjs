import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/admin/client-reviews?request=test'});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url),React=require('react'),{createRoot}=require('react-dom/client');
const code=ts.transpileModule(fs.readFileSync('app/admin/client-reviews/VerificationQueue.tsx','utf8').replace('function VerificationCard(','export function VerificationCard('),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function mount(){
 window.history.replaceState({},'','/admin/client-reviews?request=test');
 const calls=[];let item={id:'test',status:'pending',legal_name:'Client',attorney_name:'Attorney',bar_number:'FL:662348',court:'Court',county:'County',state:'FL',docket:'123',review_status:'',decision_note:'',rejection_email_status:'accepted'};
 const author={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/review-author.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:author});const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>name.includes('review-author')?author:name.includes('review-ratings')?{reviewRatingCategories:[]}:name.includes('client-review-request')?{clientReviewRequest:async payload=>{calls.push(payload);return {saved:true};}}:require(name),window,document,URL,URLSearchParams});
 const root=createRoot(document.getElementById('root'));
 const render=()=>root.render(React.createElement(module.exports.VerificationCard,{key:item.id+item.status,item,onSaved:async()=>{item={...item,status:calls.at(-1).decision==='reject'?'rejected':'approved',decision_note:calls.at(-1).note};render();}}));
 await React.act(async()=>render());
 return {calls,async close(){await React.act(async()=>root.unmount());},async input(element,value){await React.act(async()=>{Object.getOwnPropertyDescriptor(element instanceof window.HTMLTextAreaElement?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new window.Event('input',{bubbles:true}));});},async click(button){await React.act(async()=>button.click());},async submit(){await React.act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));}};
}
test('Reject explains missing reason, bypasses approval fields, then collapses with Rejected status',async()=>{
 const x=await mount();try{
 const reject=[...document.querySelectorAll('button')].find(b=>b.textContent==='Reject request');assert.equal(reject.disabled,false);await x.click(reject);assert.match(document.querySelector('[role=alert]').textContent,/rejection reason.*5 characters/);assert.equal(x.calls.length,0);
 await x.input(document.querySelector('textarea'),'Incorrect case information.');await x.click(reject);assert.equal(x.calls.length,1);assert.equal(x.calls[0].decision,'reject');assert.equal(x.calls[0].source,'');assert.equal(x.calls[0].identityChecked,false);assert.equal(document.querySelector('.verification-details').hidden,true);assert.equal(document.querySelector('.verification-status').textContent,'rejected');assert.equal(new URL(window.location.href).searchParams.has('request'),false);assert.match(document.querySelector('.record-note').textContent,/FL #662348/);
 }finally{await x.close();}
});
test('Accept reports missing requirements and only saves after URL, note, and all checks are complete',async()=>{
 const x=await mount();try{
 await x.submit();assert.match(document.querySelector('[role=alert]').textContent,/decision note/);await x.input(document.querySelector('textarea'),'Verified against the official record.');await x.submit();assert.match(document.querySelector('[role=alert]').textContent,/court record URL/);await x.input(document.querySelector('input[type=url]'),'https://court.example/case/123');await x.submit();assert.match(document.querySelector('[role=alert]').textContent,/all three verification checks/);assert.equal(x.calls.length,0);
 for(const checkbox of document.querySelectorAll('input[type=checkbox]'))await x.click(checkbox);await x.submit();assert.equal(x.calls.length,1);assert.equal(x.calls[0].decision,'approve');assert.equal(document.querySelector('.verification-status').textContent,'approved');assert.equal(document.querySelector('.verification-details').hidden,true);
 }finally{await x.close();}
});
