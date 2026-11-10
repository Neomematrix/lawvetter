import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('Submission table paginates, opens hash-linked reviews, restores focus and preserves review safeguards',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/admin/directory-submissions'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 const items=Array.from({length:12},(_,i)=>({id:String(i),kind:'lawyer',name:'Attorney '+i,firm_name:'Example Firm',state:'TN',bar_number:'',published_record_id:'TN:LV'+i,city:'Knoxville',website:'https://firm.example/attorney',official_source_url:'https://official.example/member',submitter_name:'Submitter',submitter_email:'private@example.test',notes:'Review notes',verification_status:'manual_official_check_required',verification_note:'Review required',status:i===0?'published':'pending',review_note:'',submitted_at:'2026-10-24T18:00:00Z'}));
 const calls=[],oldFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{const data=JSON.parse(options.body);calls.push(data);return Response.json(data.action==='list'?{submissions:items}:{saved:true});};
 const code=ts.transpileModule(fs.readFileSync('app/admin/directory-submissions/page.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:spec.includes('PhotoFrameEditor')?{default:()=>React.createElement('span',null,'Photo editor')}:spec.includes('directory-details')?{directoryDetails:notes=>({notes,firmWebsite:'https://firm.example/',practiceAreas:'Family Law'})}:{decodeAttorneyDraft:()=>null};return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));const button=text=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text);
 try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.default)));assert.equal(document.querySelectorAll('tbody tr').length,10);assert.equal(document.querySelector('dialog'),null);assert.ok(!document.body.textContent.includes('private@example.test'));
  await React.act(async()=>button('Next').click());assert.equal(document.querySelectorAll('tbody tr').length,2);assert.match(document.querySelector('tbody').textContent,/Attorney 11/);
  await React.act(async()=>button('Previous').click());const trigger=document.querySelector('[aria-label="Review Attorney 0"]');await React.act(async()=>trigger.click());assert.equal(document.querySelector('dialog').open,true);assert.equal(document.body.style.overflow,'hidden');assert.match(document.querySelector('dialog').textContent,/private@example.test/);assert.equal(document.querySelector('dialog .submission-fold').open,false);assert.match(document.querySelector('dialog a[href*="attorney?bar"]').getAttribute('href'),/TN%3ALV0/);
  await React.act(async()=>button('Close').click());assert.equal(document.querySelector('dialog'),null);assert.equal(document.activeElement,trigger);assert.equal(document.body.style.overflow,'');
  await React.act(async()=>{window.history.replaceState(null,'','#submission-11');window.dispatchEvent(new window.HashChangeEvent('hashchange'));});assert.match(document.querySelector('dialog').getAttribute('aria-label'),/Attorney 11/);assert.equal(button('Approve And Publish Attorney').disabled,true);
  await React.act(async()=>document.querySelector('dialog input[type="checkbox"]').click());assert.equal(button('Approve And Publish Attorney').disabled,true);
  await React.act(async()=>{const select=document.querySelector('[aria-label="Verified Membership Status"]');select.value='Member in Good Standing';select.dispatchEvent(new window.Event('change',{bubbles:true}));});assert.equal(button('Approve And Publish Attorney').disabled,false);
  await React.act(async()=>button('Approve And Publish Attorney').click());assert.ok(calls.some(x=>x.action==='review'&&x.id==='11'&&x.officiallyVerified===true&&x.barStatus==='Member in Good Standing'));
  assert.equal(document.querySelector('dialog'),null,'Successful approval closes the review panel');assert.equal(window.location.hash,'');assert.match(document.body.textContent,/Listing approved and published/);await React.act(async()=>{window.history.replaceState(null,'','#submission-11');window.dispatchEvent(new window.HashChangeEvent('hashchange'));});await React.act(async()=>document.querySelector('dialog').dispatchEvent(new window.Event('cancel')));assert.equal(document.querySelector('dialog'),null);assert.equal(window.location.hash,'');
  await React.act(async()=>{window.history.replaceState(null,'','#submission-10');window.dispatchEvent(new window.HashChangeEvent('hashchange'));});
  await React.act(async()=>{const select=document.querySelector('[aria-label="Listing type"]');select.value='firm';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.equal(document.querySelector('[aria-label="Verified Membership Status"]'),null);assert.equal(button('Approve And Publish Firm').disabled,true);
  await React.act(async()=>document.querySelector('dialog input[type="checkbox"]').click());assert.equal(button('Approve And Publish Firm').disabled,false);
  await React.act(async()=>button('Approve And Publish Firm').click());assert.ok(calls.some(x=>x.id==='10'&&x.listingKind==='firm'&&x.listingState==='TN'&&x.officiallyVerified===true&&x.barStatus===''));

 }finally{await React.act(async()=>root.unmount());globalThis.fetch=oldFetch;dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
