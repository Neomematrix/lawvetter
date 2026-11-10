import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

async function workspace({bar='',search='',profile=true,allRejected=false}={},check){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/client-reviews'+search});
 const keys=['window','document','IS_REACT_ACT_ENVIRONMENT','fetch'],previous=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async()=>Response.json({attorney:{name:'Linked Attorney'}})});
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const base={legal_name:'Private Client',court:'County Court',county:'Fulton',state:'GA',docket:'private-case',party_role:'plaintiff',review_status:'',published_at:null};
 const requests=[{...base,id:'verified',bar_number:'LV1',attorney_name:'Approved Attorney',status:'approved'},{...base,id:'pending',bar_number:'LV2',attorney_name:'Pending Attorney',status:'pending'},{...base,id:'correction',bar_number:'LV3',attorney_name:'Correction Attorney',status:'rejected'}];
 if(allRejected)requests.forEach(request=>{request.status='rejected';});
 const account={profile:profile?{first_name:'Private',last_name:'Client',legal_name:'Private Client',email:'private@example.test',initial_docket:''}:null,signedInEmail:'private@example.test',requests,isAdmin:false};
 const stubs={
  'react':React,'react/jsx-runtime':jsx,'../ActivityPanel':{default:()=>null},'./FirmInboxPanel':{default:()=>null},'./FirmRosterPanel':{default:()=>null},
  '../WebsiteBadgePanel':{default:()=>null},
  '../profile-request':{profileRequest:async()=>({profiles:[]})},
  '../client-review-request':{clientReviewRequest:async()=>account},
  './seo':{SITE_ORIGIN:'https://lawvetter.test'},
  '../seo':{attorneyPath:a=>'/lawyers/'+a.bar_number},
  '../firm/FirmAttorneyPhoto':{default:({name})=>React.createElement('span',{className:'firm-attorney-photo'},name[0])},
  './ReviewEditor':{default:({request})=>React.createElement('button',{'data-editor':request.id},'Write a review')},
  '../us-states':{usStates:['GA','FL']},
  '../LocationAutocomplete':{default:({label,value})=>React.createElement('label',null,label,React.createElement('input',{name:label,value,readOnly:true}))},
  '../location-options':{countyOptions:()=>[],courtOptions:()=>[]},
  '../Shortlist':{useShortlist:()=>({loading:false,error:'',attorneys:[{bar_number:'saved',name:'Saved Attorney',city:'Atlanta',state:'GA'}]}),SaveAttorneyButton:()=>React.createElement('button',null,'Saved')}
 };
 const cache=new Map();async function load(file){if(cache.has(file))return cache.get(file);let module;
  if(stubs[file]){const values=stubs[file];module=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);});cache.set(file,module);await module.link(()=>{});return module;}
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  module=new vm.SourceTextModule(code);cache.set(file,module);await module.link(spec=>load(stubs[spec]?spec:path.resolve(path.dirname(file),spec+'.tsx')));return module;
 }
 const mod=await load(path.resolve('app/client-reviews/ClientReviewAccount.tsx'));await mod.evaluate();const root=createRoot(document.getElementById('root'));
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
 try{await React.act(async()=>root.render(React.createElement(mod.namespace.default,{bar,accountSettings:React.createElement('div',null,React.createElement('p',null,'private@example.test'),React.createElement('button',null,'Change password'),React.createElement('a',{href:'/account/delete'},'Delete my account'))})));await check({React,button,requests,account});}
 finally{await React.act(async()=>root.unmount());dom.window.close();for(const k of keys)Object.defineProperty(globalThis,k,{value:previous[k],configurable:true,writable:true});}
}

test('Client workspace separates attorneys, reviews, shortlist and settings without dashboard clutter',async()=>workspace({},async({React,button})=>{
 assert.equal(document.querySelector('h1').textContent,'My attorneys');assert.equal(document.querySelectorAll('.client-request-details').length,2);assert.equal(document.querySelector('#verification-LV3'),null);
 assert.doesNotMatch(document.body.textContent,/Pending requests|Linked attorneys|Profiles you manage|Signed in as|Delete my account|private@example.test/);
 assert.equal(document.querySelector('.client-dashboard-heading'),null);assert.equal(document.querySelector('.client-dashboard-stats'),null);
 assert.equal(document.querySelector('a[href="/discover"]').textContent,'Find an attorney');
 await React.act(async()=>button('My reviews').click());assert.equal(document.querySelector('h1').textContent,'My reviews');assert.equal(document.querySelectorAll('.client-request-details').length,1);assert.equal(document.querySelector('[data-editor]').dataset.editor,'verified');
 await React.act(async()=>button('Shortlist').click());assert.match(document.querySelector('.client-workspace-main').textContent,/Saved Attorney/);assert.equal(document.querySelector('a[href="/lawyers/saved"]').textContent,'Saved Attorney');assert.ok(document.querySelector('a[href="/?view=shortlist"]'));
 await React.act(async()=>button('Account settings').click());assert.equal(document.querySelector('h1').textContent,'Account settings');assert.ok(button('Change password'));assert.ok(document.querySelector('a[href="/account/delete"]'));assert.equal(document.querySelectorAll('.client-request-details').length,0);
 await React.act(async()=>button('My attorneys').click());assert.equal(document.querySelectorAll('.client-request-details').length,2);
}));

test('Client verification correction links still expose the original case form and evidence field',async()=>workspace({bar:'LV3',search:'?bar=LV3'},async()=>{
 const form=document.getElementById('request-details');assert.ok(form);assert.equal(form.querySelector('input[name="docket"]').value,'private-case');assert.ok(form.querySelector('input[type="file"]'));assert.equal(form.querySelector('input[name="caseFirstName"]').value,'Private');assert.equal(document.querySelector('#verification-LV3'),null);
 assert.equal(document.querySelector('a[href="/client-reviews?bar=LV3"]'),null);
}));

test('Notification deep links open the matching attorney and new clients can still create their private profile',async()=>{
 await workspace({search:'?request=pending'},async()=>{assert.ok(document.querySelector('#verification-LV2').open);assert.ok(document.querySelector('a[href="/client-reviews?bar=LV2&edit=1#request-details"]'));});
 await workspace({profile:false},async()=>{assert.ok(document.querySelector('input[name="firstName"]'));assert.ok(document.querySelector('input[name="consent"]'));assert.match(document.body.textContent,/Create client profile/);});
});

test('Password changes remain available inside account settings without a second logout control',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/client-reviews'});
 const keys=['window','document','Event','IS_REACT_ACT_ENVIRONMENT','fetch'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const calls=[];Object.assign(globalThis,{window:dom.window,document:dom.window.document,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,options={})=>{if(options.method==='POST'){calls.push(JSON.parse(options.body));return Response.json({ok:true});}return Response.json({client:{email:'private@example.test'}});}});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const code=ts.transpileModule(fs.readFileSync('app/client-reviews/ClientAccountGate.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const stubs={'react':React,'react/jsx-runtime':jsx,'../ChangeLoginEmail':{default:()=>null},'../EmailAccessNotice':{default:()=>null},'../phone-format':{formatPhoneEvent:()=>{}},'../client-phone':{clientPhone:()=>{}},'../PasswordInput':{default:props=>React.createElement('input',{type:'password',...props})},'../DirectoryCaptcha':{default:()=>null},'../LawVetterReviewIntro':{default:()=>null},'./ClientReviewAccount':{default:({accountSettings})=>React.createElement('section',null,accountSettings)}};
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=stubs[spec];return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.default,{bar:''})));
  assert.doesNotMatch(document.body.textContent,/Signed in as|Log out/);
  await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Change password').click());
  for(const [name,value] of [['currentPassword','old-password'],['password','new-password'],['confirmPassword','new-password']])await React.act(async()=>{const input=document.querySelector('input[name="'+name+'"]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  assert.ok(calls.some(c=>c.action==='change-password'&&c.password==='new-password'&&c.currentPassword==='old-password'));assert.match(document.body.textContent,/Password changed/);assert.equal(document.querySelector('form'),null);assert.ok(document.querySelector('a[href="/account/delete"]'));
 }finally{await React.act(async()=>root.unmount());dom.window.close();for(const k of keys)Object.defineProperty(globalThis,k,{value:old[k],configurable:true,writable:true});}
});

test('Rejected-only accounts show the empty attorney state without removing stored requests',async()=>workspace({allRejected:true},async({requests})=>{assert.equal(document.querySelectorAll('.client-request-details').length,0);assert.match(document.querySelector('.client-workspace-empty').textContent,/Your attorneys will appear here/);assert.equal(requests.length,3);assert.ok(requests.every(request=>request.status==='rejected'));}));
