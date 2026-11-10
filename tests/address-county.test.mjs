import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {JSDOM} from 'jsdom';
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const synthetic=values=>new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);});
test('County lookup normalizes suites and ZIP+4 and retries the alternate Census parser',async()=>{
 const old=globalThis.fetch;const urls=[];
 globalThis.fetch=async url=>{const u=new URL(url);urls.push(u);if(u.pathname.endsWith('/address'))return Response.json({result:{addressMatches:[]}});return Response.json({result:{addressMatches:[{addressComponents:{state:'CA',zip:'90010'},geographies:{Counties:[{NAME:'Los Angeles County'}]}}]}});};
 const mod=new vm.SourceTextModule(transpile('app/api/address-county/route.ts'));await mod.link(spec=>synthetic(spec.includes('profile-access')?{sameOrigin:()=>true}:{allowDirectoryAttempt:async()=>true}));await mod.evaluate();
 try{
  const response=await mod.namespace.POST(new Request('https://lawvetter.test/api/address-county',{method:'POST',body:JSON.stringify({address:'2960 Wilshire Blvd Ste 200',city:'Los Angeles',state:' ca ',zip:'90010-1234'})}));
  assert.equal((await response.json()).county,'Los Angeles County');assert.equal(urls.length,2);assert.equal(urls[0].searchParams.get('street'),'2960 Wilshire Blvd');assert.equal(urls[0].searchParams.get('zip'),'90010');assert.match(urls[1].pathname,/onelineaddress$/);assert.equal(urls[1].searchParams.get('address'),'2960 Wilshire Blvd, Los Angeles, CA, 90010');
  urls.length=0;globalThis.fetch=async url=>{urls.push(new URL(url));if(urls.length===1)throw Error('Temporary upstream failure');return Response.json({result:{addressMatches:[{addressComponents:{state:'CA',zip:'90010'},geographies:{Counties:[{NAME:'Los Angeles County'}]}}]}});};
  const retry=await mod.namespace.POST(new Request('https://lawvetter.test/api/address-county',{method:'POST',body:JSON.stringify({address:'2960 Wilshire Blvd #200',city:'Los Angeles',state:'CA',zip:'90010'})}));assert.equal((await retry.json()).county,'Los Angeles County');assert.equal(urls[0].searchParams.get('street'),'2960 Wilshire Blvd');
 }finally{globalThis.fetch=old;}
});

test('Admin county fills automatically, cancels stale addresses, preserves corrections and bounds stalled requests',async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 let next=0;const timers=new Map(),requests=[];
 const context=vm.createContext({AbortController,setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id),fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))});
 const mod=new vm.SourceTextModule(transpile('app/admin/records/AdminCountyField.tsx'),{context});await mod.link(spec=>{const values=spec==='react'?React:jsx;return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));let change;let address='2960 Wilshire Blvd Ste 200';
 function Form(){const [county,setCounty]=React.useState('');change=setCounty;return React.createElement(mod.namespace.default,{address,city:'Los Angeles',state:'CA',zip:'90010',value:county,onChange:setCounty});}
 async function flush(ms){await React.act(async()=>{for(const[id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}});}
 try{
  await React.act(async()=>root.render(React.createElement(Form)));await flush(600);assert.equal(requests.length,1);
  await React.act(async()=>requests[0].resolve(Response.json({county:'Los Angeles County'})));assert.equal(document.querySelector('input').value,'Los Angeles County');
  address='123 Main St';await React.act(async()=>root.render(React.createElement(Form)));assert.equal(document.querySelector('input').value,'');await flush(600);
  address='456 Main St';await React.act(async()=>root.render(React.createElement(Form)));assert.equal(requests[1].options.signal.aborted,true);await flush(600);
  await React.act(async()=>requests[1].resolve(Response.json({county:'Stale County'})));assert.equal(document.querySelector('input').value,'');
  await flush(12000);assert.match(document.querySelector('[role=status]').textContent,/timed out/);assert.equal(requests[2].options.signal.aborted,true);
  await React.act(async()=>document.querySelector('button').click());await flush(600);assert.equal(requests.length,4);
  await React.act(async()=>requests[3].resolve(Response.json({county:'Los Angeles County'})));assert.equal(document.querySelector('input').value,'Los Angeles County');
  address='789 Main St';await React.act(async()=>root.render(React.createElement(Form)));await flush(600);
  await React.act(async()=>{const input=document.querySelector('input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'Manual County');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await React.act(async()=>requests[4].resolve(Response.json({county:'Overwrite County'})));assert.equal(document.querySelector('input').value,'Manual County');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
test('County lookup uses one matching street address and ZIP, and never guesses from ambiguous or mismatched results',async()=>{
 let matches=[],calls=0;const old=globalThis.fetch;globalThis.fetch=async url=>{calls++;const u=new URL(url);assert.equal(u.hostname,'geocoding.geo.census.gov');assert.equal(u.searchParams.has('layers'),false);return Response.json({result:{addressMatches:matches}});};
 const mod=new vm.SourceTextModule(transpile('app/api/address-county/route.ts'));await mod.link(spec=>synthetic(spec.includes('profile-access')?{sameOrigin:()=>true}:{allowDirectoryAttempt:async()=>true}));await mod.evaluate();
 const send=payload=>mod.namespace.POST(new Request('https://lawvetter.test/api/address-county',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));const address={address:'123 Main St',city:'Knoxville',state:'TN',zip:'37902'},match={addressComponents:{state:'TN',zip:'37902'},geographies:{Counties:[{NAME:'Knox County'}]}};
 try{assert.equal((await send({...address,zip:'x'})).status,400);assert.equal(calls,0);matches=[match];assert.equal((await(await send(address)).json()).county,'Knox County');matches=[match,match];assert.equal((await(await send(address)).json()).county,null);matches=[{...match,addressComponents:{state:'GA',zip:'30303'}}];assert.equal((await(await send(address)).json()).county,null);globalThis.fetch=async()=>{throw Error('Network unavailable');};assert.equal((await send(address)).status,503);}finally{globalThis.fetch=old;}
});
test('County autofill preserves a manual correction even when an earlier lookup completes later',async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');let resolve,calls=0;const old=globalThis.fetch;globalThis.fetch=()=>{calls++;return new Promise(r=>{resolve=r;});};const mod=new vm.SourceTextModule(transpile('app/add-listing/ListingAddressFields.tsx'));await mod.link(spec=>synthetic(spec==='react'?React:jsx));await mod.evaluate();const root=createRoot(document.getElementById('root'));
 async function type(name,value){await React.act(async()=>{const input=document.querySelector('[name="'+name+'"]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});}
 try{await React.act(async()=>root.render(React.createElement(mod.namespace.default,{state:'TN',city:'Knoxville',kind:'lawyer'})));await type('address','123 Main St');await type('zip','37902');await React.act(async()=>new Promise(r=>setTimeout(r,650)));assert.equal(calls,1);await type('county','Manual County');await React.act(async()=>resolve(Response.json({county:'Knox County'})));assert.equal(document.querySelector('[name="county"]').value,'Manual County');assert.match(document.querySelector('[role="status"]').textContent,/manually/);}finally{await React.act(async()=>root.unmount());globalThis.fetch=old;dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
