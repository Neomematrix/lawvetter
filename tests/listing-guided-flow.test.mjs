import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Guided listing validates each step, preserves hidden fields and submits the complete payload',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.com/add-listing'});
 const keys=['window','document','FormData','requestAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];const old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,FormData:dom.window.FormData,requestAnimationFrame:callback=>setTimeout(callback,0),IS_REACT_ACT_ENVIRONMENT:true});
 const previousFetch=globalThis.fetch;let sent;
 globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body.get('data'));return Response.json({id:'test-submission',notificationEmailStatus:'accepted',verificationStatus:'registry_match'});};
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const field=(name,props={})=>React.createElement('input',{name,...props});
 function Captcha({onReady}){React.useEffect(()=>onReady(true),[onReady]);return field('captchaToken',{type:'hidden',value:'test-token',readOnly:true});}
 function Practice({value,onChange}){return React.createElement(React.Fragment,null,React.createElement('select',{name:'practiceChoice',required:!value,value:'',onChange:e=>onChange(e.target.value)},React.createElement('option',{value:''},'Choose practice'),React.createElement('option',{value:'Family Law'},'Family Law')),field('practiceAreas',{type:'hidden',value,readOnly:true}));}
 const deps={'../LanguagePicker':{default:()=>null},
  '../phone-format':{formatPhoneEvent:()=>{}},
  '../firm-submission-requirements':{requireFirmSubmission:()=>{}},
  '../attorney-location':{requireAttorneyLocation:(city,state)=>{assert.ok(city);assert.equal(state,'GA');}},
  '../admin/records/FirmImageUpload':{default:()=>null},'../PhotoFrameEditor':{default:()=>null},
  '../DirectoryCaptcha':{default:Captcha},'../CityAutocomplete':{default:({required})=>field('city',{required})},
  './ListingAddressFields':{default:({kind})=>React.createElement(React.Fragment,null,...['address','zip','county'].map(name=>field(name,{key:name,required:kind==='firm'})))},'./ListingPracticePicker':{default:Practice}
 };
 const code=ts.transpileModule(fs.readFileSync('app/add-listing/AddListing.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:deps[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));const panel=n=>document.querySelector(`[data-listing-step="${n}"]`);const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
 async function click(el){await React.act(async()=>{el.click();await new Promise(resolve=>setTimeout(resolve,5));});}
 function set(name,value){const input=document.querySelector(`[name="${name}"]`);input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));}
 try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.default)));
  await click(button('Add a firm'));
  assert.equal(document.querySelector('[name="city"]').required,true);
  assert.equal(document.querySelector('[name="state"]').value,'');
  set('name','Example Firm');set('city','Atlanta');await click(button('Continue'));assert.equal(panel(0).hidden,false,'A state must be selected explicitly');
  await React.act(async()=>{const state=document.querySelector('[name="state"]');state.value='GA';state.dispatchEvent(new window.Event('change',{bubbles:true}));});
  set('city','Atlanta');await click(button('Continue'));assert.equal(panel(1).hidden,false);
  assert.ok(panel(1).querySelector('[name="biography"]'),'Firm biography belongs in professional details');
  assert.equal(panel(2).querySelector('[name="biography"]'),null);
  for(const name of ['website','phone','address','zip','county'])assert.equal(document.querySelector(`[name="${name}"]`).required,true,name+' must be required');
  assert.equal(document.querySelector('[name="publicEmail"]').required,false);
  assert.ok(document.querySelector('[name="phone"]').closest('label').querySelector('.required-mark'));
  assert.equal(document.querySelector('[name="publicEmail"]').closest('label').querySelector('.required-mark'),null);
  set('website','https://firm.example');set('phone','4045550100');set('publicEmail','info@firm.example');set('address','123 Main Street');set('zip','30301');set('county','Fulton');
  await click(button('Continue'));assert.equal(panel(2).hidden,false,'Image upload is optional');
  await click(button('Add a lawyer'));
  assert.equal(document.querySelector('[name="state"]').value,'');
  await React.act(async()=>{const state=document.querySelector('[name="state"]');state.value='GA';state.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.equal(panel(0).hidden,false);assert.equal(panel(1).hidden,true);assert.equal(document.querySelector('[name="submitterMiddleName"]'),null);
  await click(button('Continue'));assert.equal(panel(0).hidden,false);assert.equal(sent,undefined);
  set('firstName','Jane');set('lastName','Lawyer');set('city','Atlanta');set('officialSourceUrl','https://bar.example/jane');
  await click(button('Continue'));assert.equal(panel(0).hidden,false,'Practice area is required');
  await React.act(async()=>{const select=document.querySelector('[name="practiceChoice"]');select.value='Family Law';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  await click(button('Continue'));assert.equal(panel(1).hidden,false);
  assert.equal(panel(1).querySelector('[name="biography"]').required,false);set('biography','Experienced family lawyer.');set('firmWebsite','https://firm.example');set('website','https://firm.example/jane');set('publicEmail','invalid');
  await click(button('Continue'));assert.equal(panel(1).hidden,false,'Invalid optional email must block navigation');
  set('publicEmail','jane@firm.example');await click(button('Continue'));assert.equal(panel(2).hidden,false);
  await click(button('Back'));assert.equal(panel(1).hidden,false);assert.equal(document.querySelector('[name="website"]').value,'https://firm.example/jane');
  await click(button('Continue'));set('submitterFirstName','Kyle');set('submitterLastName','George');set('submitterEmail','kyle@example.com');
  await React.act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(sent.biography,'Experienced family lawyer.');assert.equal(sent.name,'Jane Lawyer');assert.equal(sent.submitterName,'Kyle George');assert.equal(sent.website,'https://firm.example/jane');assert.equal(sent.firmWebsite,'https://firm.example');assert.equal(sent.practiceAreas,'Family Law');assert.equal(sent.captchaToken,'test-token');assert.match(document.body.textContent,/Waiting For Approval/);
 }finally{await React.act(async()=>root.unmount());globalThis.fetch=previousFetch;dom.window.close();for(const key of keys){if(old[key]===undefined)delete globalThis[key];else globalThis[key]=old[key];}}
});
