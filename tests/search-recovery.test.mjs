import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
async function load(file,context,stubs={}){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const m=new vm.SourceTextModule(code,{context});await m.link(spec=>{const values=stubs[spec];return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});await m.evaluate();return m.namespace;}
test('Firm search suggests firms and selects the firm with keyboard',async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');let picked=null;const calls=[];
 const context=vm.createContext({AbortController,URLSearchParams,setTimeout,clearTimeout,fetch:async url=>{calls.push(String(url));return Response.json(String(url).includes('kind=firms')?{firms:[{name:'Downs Aaron',firm_key:'downsaaron',attorneys:1}]}:{attorneys:[{name:'Tabatha Boltze',bar_number:'FL:1022173',company:'Downs Aaron',city:'Orlando',state:'FL'}]});}});
 const m=await load('app/AttorneyNameInput.tsx',context,{'react':React,'react/jsx-runtime':jsx,'./practice-catalog':{searchPracticeArea:()=>null},'./attorney-identity':{displayBarNumber:v=>v}}),root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(React.createElement(m.default,{kind:'firms',value:'downs aa',city:'',enabled:true,onChange:()=>{},onSelect:a=>{picked=a;},onSelectFirm:f=>{picked=f;}})));const input=document.querySelector('input');await React.act(async()=>input.focus());await React.act(async()=>new Promise(r=>setTimeout(r,300)));assert.equal(calls.length,1);assert.ok(calls.every(u=>u.includes('statusGroup=all')));assert.equal(document.querySelectorAll('[role=option]').length,1);assert.match(document.querySelector('[role=option]').textContent,/Downs AaronLaw firm/);await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));assert.equal(picked.firm_key,'downsaaron');assert.equal(input.getAttribute('aria-expanded'),'false');}
 finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
test('Failed deployment scripts preserve the page and show a cache-busting reload link',async()=>{
 const m=await load('app/asset-recovery.ts',vm.createContext({})),listeners={},storage=new Map();let reloads=0;const dom=new JSDOM('<body></body>');
 const context=vm.createContext({URL,Date,document:dom.window.document,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{href:'https://lawvetter.test/firm?name=Example',reload:()=>reloads++},addEventListener:(name,fn)=>listeners[name]=fn});
 vm.runInContext(m.assetRecoveryScript,context);listeners.error({target:{tagName:'IMG',src:'/api/profile-photo'}});assert.equal(reloads,0);listeners.error({target:{tagName:'SCRIPT',src:'https://lawvetter.test/assets/FirmProfile.js'}});assert.equal(reloads,0);listeners.error({target:{tagName:'SCRIPT',src:'/assets/other.js'}});assert.equal(reloads,0);
 vm.runInContext(m.assetRecoveryScript,context);listeners['vite:preloadError']({preventDefault(){}});assert.equal(reloads,0);assert.match(dom.window.document.querySelector('[role=alert]').textContent,/Reload page/);assert.match(dom.window.document.querySelector('a').href,/^https:\/\/lawvetter.test\/firm\?name=Example&_lv_reload=\d+$/);dom.window.close();
});


test('Public settings survive database errors using defaults or the last successfully read settings',async()=>{
 let fail=true,stored={origin:'https://lawvetter.com',gaMeasurementId:'G-ABCDE12345',googleVerification:'verified-token',bingVerification:''};
 let clock=0;const context=vm.createContext({Date:{now:()=>clock},setTimeout,clearTimeout,console:{error(){},warn(){}}});const cache=await load('db/public-read-cache.ts',context);
 const m=await load('db/site-settings.ts',context,{'./public-read-cache':cache,'cloudflare:workers':{env:{}},'./raw':{rawDb:()=>({prepare:()=>({first:async()=>{if(fail)throw Error('Database temporarily unavailable');return {value:JSON.stringify(stored)};}})})},'../app/seo':{SITE_ORIGIN:'https://www.lawvetter.com'}});
 assert.equal((await m.publicSettings()).origin,'https://www.lawvetter.com');fail=false;clock+=15001;assert.equal((await m.publicSettings()).gaMeasurementId,stored.gaMeasurementId);fail=true;clock+=15001;assert.equal((await m.publicSettings()).origin,stored.origin);assert.equal((await m.publicSettings()).googleVerification,stored.googleVerification);assert.equal(await m.siteOrigin(),stored.origin);
});

 test('A stalled settings lookup falls back and can recover on the next refresh',async()=>{
 let stalled=true,clock=0,reads=0;
 const context=vm.createContext({Date:{now:()=>clock},setTimeout:(fn,ms)=>setTimeout(fn,ms===1500?5:50),clearTimeout,console:{error(){},warn(){}}});
 const cache=await load('db/public-read-cache.ts',context);
 const m=await load('db/site-settings.ts',context,{'./public-read-cache':cache,'cloudflare:workers':{env:{}},'./raw':{rawDb:()=>({prepare:()=>({first:()=>{reads++;return stalled?new Promise(()=>{}):Promise.resolve({value:JSON.stringify({origin:'https://lawvetter.com',gaMeasurementId:'G-ABCDE12345'})});}})})},'../app/seo':{SITE_ORIGIN:'https://www.lawvetter.com'}});
 const values=await Promise.all([m.publicSettings(),m.publicSettings()]);
 assert.equal(values[0].origin,'https://www.lawvetter.com');assert.equal(reads,1);
 stalled=false;clock+=15001;
 assert.equal((await m.publicSettings()).gaMeasurementId,'G-ABCDE12345');
 stalled=true;clock+=15001;
 assert.equal((await m.publicSettings()).origin,'https://lawvetter.com');
 });
