import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

test('lawyer account sidebar switches profile, analytics, inbox and settings',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/account'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const oldFetch=globalThis.fetch;globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('firm-management')?{firms:[{name:'Test Firm'}]}:{profiles:[],monthLabel:'November'}});
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client'),nil=()=>null;
 const profile={bar_number:'123',name:'Test Lawyer',state:'GA',company:'Test Firm',headline:'',bio:'',practice_areas:'',website:''};
 const deps={'../LanguagePicker':{default:nil},react:React,'react/jsx-runtime':jsx,'../ProfessionalWorkspaceSwitch':{default:()=>React.createElement('div',null,'Workspace switch')},'../WebsiteBadgePanel':{default:()=>React.createElement('div',{'data-badge':true},'Website badge')},'../ChangeLoginEmail':{default:()=>React.createElement('p',null,'Change login email')},'../ActivityPanel':{default:()=>React.createElement('p',null,'Analytics content')},'../PhotoFrameEditor':{default:nil},'./AttorneyReferrals':{default:()=>React.createElement('p',null,'Inbox content')},'../seo':{attorneyPath:()=>'/attorney/test'},'../VerifiedOwnershipBadge':{default:nil},'../attorney-identity':{displayBarNumber:x=>x},'./NewAttorneyProfile':{default:nil},'../ClaimProfile':{default:nil},'../SiteHeader':{default:nil},'../practice-catalog':{practiceAreas:[]},'../profile-request':{profileRequest:async()=>({profiles:[profile],claims:[],submissions:[],isAdmin:false})}};
 const code=ts.transpileModule(fs.readFileSync('app/account/AttorneyAccount.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);await mod.link(spec=>{assert.ok(deps[spec],spec);const values=deps[spec];return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);});});await mod.evaluate();
 const root=createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(mod.namespace.default,{onLogout:()=>{},logoutBusy:false})));
  assert.ok(document.querySelector('.client-workspace-sidebar [data-badge]'));
  assert.ok(document.querySelector('.lawyer-sidebar-workspace'));
  for(const [label,id]of [['Analytics','my-lawyer-analytics'],['Inbox','my-lawyer-inbox'],['Account settings',null],['My profile','my-lawyer-profile']]){
   const button=[...document.querySelectorAll('.client-workspace-sidebar button')].find(b=>b.textContent===label);
   await React.act(async()=>button.click());assert.equal(button.getAttribute('aria-current'),'page');assert.equal(document.querySelector('#my-lawyer-title').textContent,label);
   if(id)assert.equal(document.getElementById(id).closest('[hidden]'),null);
   if(label==='Account settings')assert.equal([...document.querySelectorAll('p')].find(p=>p.textContent==='Change login email').closest('[hidden]'),null);
  }
  assert.equal(document.querySelector('#my-lawyer-analytics').hidden,true);assert.equal(document.querySelector('#my-lawyer-inbox').hidden,true);
  assert.ok(document.querySelector('#my-lawyer-profile .gold-button'),'Profile editing remains available');
 }finally{await React.act(async()=>root.unmount());globalThis.fetch=oldFetch;dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
