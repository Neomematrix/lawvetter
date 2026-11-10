import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import {DatabaseSync} from 'node:sqlite';

async function plain(file){const mod=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);await mod.link(()=>{});await mod.evaluate();return mod.namespace;}
for(const record of [
 {name:'Early Homepage Lawyer',state:'GA',license:'777004',public_id:'abcdef1234567890abcdef1234567004',home:true,location:'Atlanta',early:true},
 {name:'Homepage ZIP Lawyer',state:'GA',license:'777001',public_id:'abcdef1234567890abcdef1234567001',home:true,location:'30114'},
 {name:'Homepage City Lawyer',state:'GA',license:'777002',public_id:'abcdef1234567890abcdef1234567002',home:true,location:'Atlanta'},
 {name:'Homepage Practice Search',state:'GA',license:'777003',public_id:'abcdef1234567890abcdef1234567003',home:true,location:'30114',practice:true},
 {name:'Pearson Behle & Latimer',state:'UT',license:'fixture',public_id:'abcdef1234567890abcdef1234567891',firm:true},
 {name:'Desktop Example Lawyer',state:'GA',license:'654321',public_id:'abcde01234567890abcde01234567890',desktop:true},
 {name:'Christopher Kevin Rhodes',state:'GA',license:'123456',public_id:'f846e5fdc2765476d298dd3109304055'},
 {name:'Florida Example Lawyer',state:'FL',license:'FL:123456',public_id:'1234567890abcdef1234567890abcdef'},
 {name:'Jose Calvo',state:'FL',license:'345678',public_id:'1234567890abcdef1234567890abc123',duplicates:true},
 {name:'Single Row On Many Results',state:'GA',license:'345679',public_id:'1234567890abcdef1234567890abc124',totalOverride:22},
 {name:'Georgia Without License',state:'GA',license:'GA:LVabc123',public_id:'abcdef1234567890abcdef1234567890'}
])test('Search selection, reload and profile navigation: '+record.name,async()=>{
 const previousFetch=globalThis.fetch,selectionEvents=[];globalThis.fetch=async(url,options)=>{selectionEvents.push({url,...options});return Response.json({});};
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/discover'+(record.firm?'?q='+encodeURIComponent(record.name)+'&kind=firms':'')}),navigations=[];
 let mobile=!record.desktop;const mediaListeners=new Set(),media={get matches(){return mobile;},addEventListener:(_,fn)=>mediaListeners.add(fn),removeEventListener:(_,fn)=>mediaListeners.delete(fn)};
 globalThis.CustomEvent=dom.window.CustomEvent;
 globalThis.window={dispatchEvent:dom.window.dispatchEvent.bind(dom.window),matchMedia:()=>media,location:{get search(){return dom.window.location.search;},assign:url=>navigations.push(url)},history:dom.window.history,addEventListener:dom.window.addEventListener.bind(dom.window),removeEventListener:dom.window.removeEventListener.bind(dom.window)};
 globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const testWindow=globalThis.window;globalThis.window=dom.window;
 const React=await import('react'),jsx=await import('react/jsx-runtime'),{createRoot}=await import('react-dom/client');
 globalThis.window=testWindow;
 const {attorneyNameSearch}=await plain('app/api/attorneys/search.ts'),seo=await plain('app/seo.ts'),radii=await plain('app/search-radius.ts');
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE attorneys(name TEXT,state TEXT,bar_number TEXT,license_number TEXT,company TEXT,public_id TEXT)');sql.prepare('INSERT INTO attorneys VALUES(?,?,?,?,?,?)').run(record.name,record.state,record.license,record.license,'Example Firm',record.public_id);
 sql.exec("ALTER TABLE attorneys ADD COLUMN employer_name TEXT NOT NULL DEFAULT ''; ALTER TABLE attorneys ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'Law Firm Attorney'");
 const attorney={name:record.name,state:record.state,bar_number:'LV'+record.public_id,public_id:record.public_id,company:'Example Firm',city:'Atlanta'},calls=[];
 let failSearch=false;
 const requestAttorneyData=async params=>{if(failSearch)throw Error("Attorney records are temporarily unavailable.");calls.push(params);if(record.firm)return {attorneys:[],firms:[{name:record.name,firm_key:'pearsonbehlelatimer',attorneys:0}],total:1,paginationTotal:1,page:1};if(params.id){assert.equal(params.id,attorney.bar_number);return {attorney};}const s=attorneyNameSearch(params.q),rows=sql.prepare('SELECT name FROM attorneys WHERE '+s.where).all(...s.args);return {attorneys:rows.flatMap(()=>record.duplicates?[attorney,{...attorney,bar_number:attorney.bar_number+'x'}]:[attorney]),total:record.totalOverride||(record.duplicates?rows.length*2:rows.length),page:1};};
 const nil=()=>null;
 const deps={react:React,'react/jsx-runtime':jsx,'./search-radius':radii,'./directory-page-size':{DIRECTORY_PAGE_SIZE:20},'./AttorneyNameInput':{default:({value,onChange,onSelect})=>React.createElement('div',null,React.createElement('input',{id:'attorney-name-input','aria-label':'Attorney name or practice area',value,onChange:e=>onChange(e.target.value)}),React.createElement('button',{type:'button',onClick:()=>onSelect(attorney)},'Select lawyer'))},'./SearchAdvertisement':{default:nil,activeSearchSponsor:()=>false},'./practice-catalog':{practiceAreas:[],practiceCoverage:'',searchPracticeArea:value=>value==='Criminal Law'?{id:'criminal-law'}:null},'./seo':seo,'./FirmLogo':{default:({name,banner})=>React.createElement('img',{alt:name+' logo','data-banner':String(banner)})},'./FirmLink':{FirmLink:({name,children})=>React.createElement('a',{href:'/firm?name='+encodeURIComponent(name)},children??name)},'./Shortlist':{ShortlistNotice:nil},'./DirectoryContent':{default:nil},'./SingleAttorneyResult':{default:({attorney})=>React.createElement('a',{'data-single-result':'true',href:seo.attorneyPath(attorney)},'Open '+attorney.name)},'./AttorneyCard':{AttorneyCard:({attorney,onOpen})=>React.createElement('button',{onClick:()=>onOpen(attorney)},'Open '+attorney.name),Charts:nil,DiscoveryHome:nil,ShortlistPage:nil},'./attorney-request':{requestAttorneyData},'./HomepageLocationInput':{default:({value,onChange})=>React.createElement('input',{name:'location',value,onChange:e=>onChange(e.target.value)})},'./HeroSpotlightState':{default:nil},'./LandingHero':{default:({search})=>search},'./PracticeAreaGrid':{default:nil},'./practice-category':{practiceAreaChoices:()=>[]}};
 const navCode=ts.transpileModule(fs.readFileSync('app/directory-navigation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText,nav=new vm.SourceTextModule(navCode);await nav.link(()=>new vm.SyntheticModule(Object.keys(radii),function(){for(const [k,v]of Object.entries(radii))this.setExport(k,v);}));await nav.evaluate();deps['./directory-navigation']=nav.namespace;
 const code=ts.transpileModule(fs.readFileSync('app/GeorgiaDirectory.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,mod=new vm.SourceTextModule(code);await mod.link(spec=>{const values=deps[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);});});await mod.evaluate();
 let root;const render=async()=>React.act(async()=>{const element=React.createElement(mod.namespace.default,{discoveryPage:!record.home,onView:()=>{}});if(record.early&&!root){const {renderToString}=await import('react-dom/server'),{hydrateRoot}=await import('react-dom/client');document.getElementById('root').innerHTML=renderToString(element);document.querySelector('#attorney-name-input').value=record.name;document.querySelector('[name=location]').value=record.location;root=hydrateRoot(document.getElementById('root'),element);}else{root??=createRoot(document.getElementById('root'));root.render(element);}});
 try{
  await render();
  if(record.home){
   assert.equal(document.querySelectorAll('form').length,1,'Homepage has one search form and no duplicate autocomplete IDs');
   if(record.early){assert.equal(document.querySelector('#attorney-name-input').value,record.name,'Initialization preserves a name typed before hydration');assert.equal(document.querySelector('[name=location]').value,record.location,'Initialization preserves a city typed before hydration');}else{
   await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
   assert.match(document.querySelector('[role=alert]').textContent,/Enter a name/);
   assert.equal(navigations.length,0,'Empty searches stay on the homepage');
   }
   const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
   await React.act(async()=>{const input=document.querySelector('[name=location]');input.focus();setter.call(input,record.location);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
   if(record.practice){
    await React.act(async()=>{const input=document.querySelector('[aria-label="Attorney name or practice area"]');input.focus();setter.call(input,'Criminal Law');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
   }else{
    await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Select lawyer').click());
    assert.equal(navigations.at(-1),seo.attorneyPath(attorney),'Selecting a homepage suggestion opens its exact profile immediately');
    assert.equal(calls.length,0,'Profile navigation does not wait for another lookup');
    assert.equal(selectionEvents[0].keepalive,true);
    assert.equal(JSON.parse(selectionEvents[0].body).id,attorney.bar_number);
    return;
   }
   const target=new URL(navigations.at(-1),'https://lawvetter.test');
   assert.equal(target.pathname,'/discover');assert.equal(target.searchParams.get('status'),'active');
   assert.equal(target.searchParams.get('q'),record.practice?null:record.name);
   assert.equal(target.searchParams.get('practice'),record.practice?'criminal-law':null);
   assert.equal(target.searchParams.get('zip'),record.location==='30114'?'30114':null);
   assert.equal(target.searchParams.get('city'),record.location==='Atlanta'?'Atlanta':null);
   assert.equal(target.searchParams.get('radius'),record.location==='30114'?'50':null);
   assert.equal(calls.length,0,'Homepage hands off to Discover without issuing a duplicate results request');
   return;
  }
  if(!record.firm){
   await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Select lawyer').click());
   assert.equal(navigations.at(-1),seo.attorneyPath(attorney),'Selecting a Discover suggestion opens the selected profile, including duplicate names');
   assert.equal(calls.length,0,'Selection does not wait for a search response');
   assert.equal(selectionEvents[0].keepalive,true);
   // A manually submitted search still retains results and filters on reload.
   await React.act(async()=>{dom.window.history.pushState({},'', '/discover?q='+encodeURIComponent(record.name));dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));});
  }
  assert.equal(new URLSearchParams(dom.window.location.search).get('q'),record.name,'Selected lawyer must use the visible name');assert.match(document.body.textContent,new RegExp((record.totalOverride||(record.duplicates?2:1))+' '+(record.firm?'firms?':'attorneys?')+' found'));assert.ok(!document.body.textContent.includes('No matches yet'));
  await React.act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await render();assert.match(document.body.textContent,new RegExp((record.totalOverride||(record.duplicates?2:1))+' '+(record.firm?'firms?':'attorneys?')+' found'),'Reload must retain the matching attorney');assert.equal(document.querySelector('.directory-kind-toggle button[aria-pressed="true"]').textContent,record.firm?'Firms':'Lawyers');
  if(!record.firm){assert.equal(Boolean(document.querySelector('[data-single-result]')),!record.desktop&&!record.duplicates&&!record.totalOverride);assert.equal(Boolean(document.querySelector('.results-card-grid')),!!record.desktop||!!record.duplicates||!!record.totalOverride);assert.equal(Boolean(document.querySelector('.directory-pagination')),!!record.totalOverride);}
  if(record.name==='Florida Example Lawyer'){
   failSearch=true;await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
   assert.match(document.body.textContent,/Search unavailable/);assert.equal(document.querySelector('[data-single-result]'),null,'Failed new search must not retain the previous attorney');assert.ok(!document.body.textContent.includes('1 attorney found'));
   failSearch=false;await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Try again').click());assert.ok(document.querySelector('[data-single-result]'));
  }
  if(record.desktop){await React.act(async()=>{mobile=true;for(const fn of mediaListeners)fn();});assert.ok(document.querySelector('[data-single-result]'));await React.act(async()=>{mobile=false;for(const fn of mediaListeners)fn();});assert.ok(document.querySelector('.results-card-grid'));assert.equal(document.querySelector('.single-match-results'),null);}
  if(record.firm){assert.equal(document.querySelector('.firm-result-card img').getAttribute('data-banner'),'true');assert.match(document.body.textContent,/0 listed attorneys/);assert.equal(document.querySelector('.firm-result-card a').getAttribute('href'),'/firm?name='+encodeURIComponent(record.name));await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.match(document.body.textContent,new RegExp((record.totalOverride||(record.duplicates?2:1))+' '+(record.firm?'firms?':'attorneys?')+' found'));assert.ok(document.querySelector('.firm-result-card'));return;}
  if(!record.desktop&&!record.duplicates&&!record.totalOverride){assert.equal(document.querySelector('[data-single-result]').getAttribute('href'),seo.attorneyPath(attorney));}else{await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Open '+record.name).click());assert.equal(navigations.at(-1),seo.attorneyPath(attorney));assert.ok(calls.some(c=>c.id===attorney.bar_number));}
  await React.act(async()=>[...document.querySelectorAll('.directory-kind-toggle button')].find(b=>b.textContent==='Firms').click());assert.equal(calls.at(-1).kind,'firms');assert.equal(calls.at(-1).q,record.name);assert.equal(calls.at(-1).page,1);assert.equal(new URLSearchParams(dom.window.location.search).get('kind'),'firms');await React.act(async()=>[...document.querySelectorAll('.directory-kind-toggle button')].find(b=>b.textContent==='Lawyers').click());assert.equal(calls.at(-1).kind,'attorneys');assert.equal(new URLSearchParams(dom.window.location.search).get('kind'),null);
  const legacy=attorneyNameSearch(attorney.bar_number);assert.equal(sql.prepare('SELECT count(*) AS total FROM attorneys WHERE '+legacy.where).get(...legacy.args).total,1,'Saved profile-ID search URLs must also work');
 }finally{await React.act(async()=>root.unmount());sql.close();dom.window.close();globalThis.fetch=previousFetch;delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
