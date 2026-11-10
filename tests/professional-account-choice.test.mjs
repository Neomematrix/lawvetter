import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

async function account({signedIn=false,search=''}={},check){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/account'+search});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const navigation=[],posts=[];let profileCalls=0;
 const browser={addEventListener:dom.window.addEventListener.bind(dom.window),removeEventListener:dom.window.removeEventListener.bind(dom.window),location:{search,assign:value=>navigation.push(value)},dispatchEvent:()=>{},scrollTo:()=>{}};
 const context=vm.createContext({window:browser,FormData:dom.window.FormData,Event:dom.window.Event,AbortSignal,URLSearchParams,fetch:async(url,options)=>{
  if(url==='/api/firm-management')return Response.json({firms:[]});assert.equal(url,'/api/client-auth');if(options?.method==='POST'){const body=JSON.parse(options.body);posts.push(body);signedIn=true;return Response.json({ok:true});}return Response.json({client:signedIn?{email:'manager@example.test'}:null});
 }});
 const source=ts.transpileModule(fs.readFileSync('app/account/AttorneyLogin.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(source,{context});
 await mod.link(spec=>{const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:spec==='./professional-account-choice.css'?{}:spec.includes('profile-request')?{profileRequest:async()=>{profileCalls++;return {profiles:[],claims:[],submissions:[]};}}:spec.includes('AttorneyAccount')?{default:()=>React.createElement('section',{'data-attorney-workspace':true},'Attorney workspace')}:spec.includes('PasswordInput')?{default:props=>React.createElement('input',{type:'password',...props})}:spec.includes('DirectoryCaptcha')?{default:()=>React.createElement('input',{type:'hidden',name:'captchaToken',value:'test-captcha'})}:{default:()=>null};return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));
 const click=async text=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,text);await React.act(async()=>button.click());};
 const submit=async()=>{const form=document.querySelector('form');for(const [name,value]of Object.entries({firstName:'Example',lastName:'Manager',email:'manager@example.test',password:'safe-test-password',confirmPassword:'safe-test-password'})){const input=form.querySelector('[name="'+name+'"]');if(input)input.value=value;}form.querySelector('[name=consent]').checked=true;await React.act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
 try{await React.act(async()=>root.render(React.createElement(mod.namespace.default,{initialSession:signedIn?'client':'guest'})));await check({click,submit,navigation,posts,profileCalls:()=>profileCalls});}
 finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
}

test('Signup distinguishes individual attorney and firm accounts and explains approval',async()=>account({},async({click})=>{
 assert.equal(document.querySelector('h1').textContent,'Your Attorney Account');assert.match(document.querySelector('.professional-account-copy').textContent,/individual lawyers/);
 await click('Firm account');assert.equal(document.querySelector('h1').textContent,'Your Firm Account');assert.match(document.querySelector('.professional-account-copy').textContent,/firm page and the attorneys listed with the firm/);assert.match(document.querySelector('.professional-access-note').textContent,/email verification and approval/);
 assert.equal(document.querySelector('form button').textContent,'Create Firm Account');assert.equal(document.querySelector('button[aria-pressed=true]').textContent,'Firm account');
 await click('Attorney account');assert.equal(document.querySelector('h1').textContent,'Your Attorney Account');assert.equal(document.querySelector('form button').textContent,'Create Attorney Account');
}));
test('Firm registration creates the shared login and continues to verified firm setup',async()=>account({},async({click,submit,navigation,posts,profileCalls})=>{
 await click('Firm account');await submit();assert.equal(posts[0].action,'register');assert.equal(posts[0].consent,true);assert.equal(posts[0].captchaToken,'test-captcha');assert.deepEqual(navigation,['/firm-access']);assert.equal(profileCalls(),0);assert.equal(document.querySelector('[data-attorney-workspace]'),null);
}));
test('Attorney registration retains individual profile onboarding',async()=>account({},async({submit,navigation,posts})=>{
 await submit();assert.equal(posts[0].action,'register');assert.deepEqual(navigation,[]);assert.ok(document.querySelector('[data-attorney-workspace]'));
}));
test('Signed-in accounts can choose firm setup without creating another login',async()=>account({signedIn:true},async({click,posts})=>{
 await click('Firm account');assert.equal(document.querySelector('h1').textContent,'Your Firm Account');assert.equal(document.querySelector('a[href="/firm-access"]').textContent,'Continue to firm setup');assert.match(document.body.textContent,/already signed in/);assert.equal(posts.length,0);
}));
test('Firm onboarding can be opened directly from an account-type link',async()=>account({search:'?type=firm'},async()=>{
 assert.equal(document.querySelector('h1').textContent,'Your Firm Account');assert.match(document.querySelector('.professional-access-note').textContent,/approval/);
}));
