import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup,renderToPipeableStream} from 'react-dom/server';
import {PassThrough} from 'node:stream';

async function component(file,deps){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);
 await mod.link(spec=>{const values=deps[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);});});await mod.evaluate();return mod.namespace;
}
const marker=name=>()=>React.createElement('section',{'data-home-view':name});
const imageURLs=await component('app/home-image-url.ts',{});
const heroState=await component('app/HeroSpotlightState.tsx',{'react/jsx-runtime':jsx});
const hero=await component('app/LandingHero.tsx',{'react/jsx-runtime':jsx,'./HeroSpotlightState':heroState});
const spotlight=await component('app/HeroMonthlySpotlight.tsx',{react:React,'react/jsx-runtime':jsx,'./HeroSpotlightState':heroState,'./MonthlySpotlight':{default:({data,variant})=>React.createElement('section',{'data-hero-spotlight':variant},data.monthly[0].name)}});
const content=await component('app/DirectoryContent.tsx',{react:React,'react/jsx-runtime':jsx});
const directory=await component('app/GeorgiaDirectory.tsx',{
 react:React,'react/jsx-runtime':jsx,
 './search-radius':{SEARCH_RADII:[-1,5,10,25,50],searchRadius:x=>x??50},
 './directory-page-size':{DIRECTORY_PAGE_SIZE:24},
 './AttorneyNameInput':{default:()=>React.createElement('input',{name:'attorney-search'})},
 './SearchAdvertisement':{default:()=>null,activeSearchSponsor:()=>null},
 './practice-catalog':{practiceAreas:[],practiceCoverage:'',searchPracticeArea:()=>null},
 './directory-navigation':{directoryLocation:()=>({}),directorySearchPath:()=>'/discover'},
 './seo':{attorneyPath:()=>'/lawyers/example'},'./FirmLink':{FirmLink:()=>null},'./FirmLogo':{default:()=>null},
 './Shortlist':{ShortlistNotice:()=>null},'./AttorneyCard':{AttorneyCard:()=>null},'./SingleAttorneyResult':{default:()=>null},
 './DirectoryContent':content,
 './attorney-request':{requestAttorneyData:()=>{throw Error('Initial SSR must not need a browser request.');}},
 './HomepageLocationInput':{default:()=>React.createElement('input',{name:'location'})},
 './HeroSpotlightState':heroState,
 './LandingHero':{default:hero.default},'./PracticeAreaGrid':{default:marker('practices')},
 './practice-category':{practiceAreaChoices:()=>[]},
});

test('Homepage content and hero are present in initial server HTML without a lazy view fallback',()=>{
 const html=renderToStaticMarkup(React.createElement(directory.default,{initialHome:{monthly:[{name:'Current Monthly Leader'}]},initialHero:spotlight.default,initialContent:marker('discover'),onView:()=>{}}));
 assert.match(html,/Verified Reviews from Real Clients/);
 assert.match(html,/data-home-view="discover"/);
 assert.doesNotMatch(html,/Loading LawVetter discovery/);
 assert.match(html,/data-hero-spotlight="hero"/);
 assert.match(html,/Current Monthly Leader/);
 assert.doesNotMatch(html,/lawvetter-attorney-welcome|lawvetter-review-check-title/);
});

test('Initial charts, shortlist and Discovery grid retain their respective server-rendered content',()=>{
 for(const[props,name]of [[{view:'charts',initialHome:{}},'charts'],[{view:'shortlist'},'shortlist'],[{discoveryPage:true},'practices']]){
  const html=renderToStaticMarkup(React.createElement(directory.default,{...props,initialContent:marker(name),onView:()=>{}}));
  assert.match(html,new RegExp('data-home-view="'+name+'"'));assert.doesNotMatch(html,/Loading LawVetter discovery/);
 }
});


test('Pending rankings do not block the server-rendered homepage hero and search',async()=>{
 let resolveData;const data=new Promise(resolve=>{resolveData=resolve;});
 const output=new PassThrough();let html='';output.on('data',chunk=>{html+=chunk;});
 let shellResolve,shellReject;const shell=new Promise((resolve,reject)=>{shellResolve=resolve;shellReject=reject;});
 const complete=new Promise((resolve,reject)=>{output.on('end',resolve);output.on('error',reject);});
 const stream=renderToPipeableStream(React.createElement(directory.default,{initialHome:data,initialHero:spotlight.default,initialContent:marker('discover'),onView:()=>{}}),{onShellReady(){stream.pipe(output);setImmediate(shellResolve);},onShellError:shellReject});
 try{
  await shell;
  assert.match(html,/id="lawvetter-hero-title"/);assert.match(html,/id="attorney-search"/);
  assert.match(html,/Loading the latest leading attorney/);assert.match(html,/data-home-view="discover"/);
  resolveData({monthly:[{name:'Streamed Monthly Leader'}]});await complete;
  assert.match(html,/Streamed Monthly Leader/);
  assert.match(html,/data-home-view="discover"/);
 }finally{resolveData({});stream.abort();}
});


test('Only the Charts view opts into the ranking loading-space reservation',async()=>{
 const home=await component('app/HomeClient.tsx',{react:React,'react/jsx-runtime':jsx,'./directory-navigation':{directoryLocation:()=>({view:'discover'})},'./GeorgiaDirectory':{default:()=>React.createElement('div',{className:'discovery-loading'})},'./ResponsiveHeader':{default:()=>null}});
 const render=view=>renderToStaticMarkup(React.createElement(home.default,{initialView:view,initialHome:{},initialContent:()=>null}));
 assert.match(render('charts'),/<main class="charts-view"><style>\.charts-view \.discovery-loading\{min-height:100vh\}<\/style><div class="discovery-loading">/);
 assert.doesNotMatch(render('discover'),/charts-view/);
 assert.doesNotMatch(render('shortlist'),/charts-view/);
});
