import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

async function load(file,stubs={},context=vm.createContext({Request,Response,Headers,URL,console})){
 const cache=new Map();
 async function module(file){
  if(cache.has(file))return cache.get(file);
  let mod;
  if(stubs[file]){const values=stubs[file];mod=new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});}
  else if(file.endsWith('.css')){mod=new vm.SyntheticModule([],function(){},{context});}
  else if(file.endsWith('.json')){const value=JSON.parse(fs.readFileSync(file,'utf8'));mod=new vm.SyntheticModule(['default'],function(){this.setExport('default',value);},{context});}
  else{const actual=fs.existsSync(file)?file:file.replace(/\.ts$/,'.tsx');const code=ts.transpileModule(fs.readFileSync(actual,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;mod=new vm.SourceTextModule(code,{context,identifier:actual});}
  cache.set(file,mod);return mod;
 }
 const m=await module(path.resolve(file));await m.link((specifier,parent)=>module(stubs[specifier]?specifier:path.resolve(path.dirname(parent.identifier),specifier)+(/\.(json|css)$/.test(specifier)?'':'.ts')));await m.evaluate();return m.namespace;
}

test('Chart portrait delivery preserves revision identity, safe fallback and placeholders',async()=>{
 const photos=await load('app/chart-avatar.ts');const bar='LV'+'a'.repeat(32);
 assert.equal(photos.chartAvatar(bar,'p123'),'/api/chart-avatar/'+bar+'.p123.webp');
 assert.match(photos.chartAvatarSet(bar,'p123'),/@3x\.webp 3x$/);
 assert.equal(photos.chartAvatarSet('123','p123'),undefined);
 assert.equal(photos.chartAvatar(bar),'/attorneys/placeholder.73de70770474.webp');
 assert.equal(photos.chartAvatar('123','p123'),'/api/profile-photo?bar=123&v=p123');
 assert.notEqual(photos.chartAvatar(bar,'original.jpg'),photos.chartAvatar(bar,'replacement.jpg'));
});

test('Chart avatars serve only public WebP assets, never forward credentials, and cache only revisioned successes',async()=>{
 const {chartAvatarResponse:serve}=await load('worker/chart-avatars.ts');
 const manifest=JSON.parse(fs.readFileSync('worker/chart-avatar-manifest.json','utf8'));
 const key=Object.keys(manifest).find(k=>k!=='placeholder');let observed;
 const assets={async fetch(request){observed=request;return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/webp','Set-Cookie':'must-not-escape=1'}});}};
 const req=new Request('https://lawvetter.test/api/chart-avatar/'+key+'.webp',{headers:{Cookie:'private-session=secret',Authorization:'Bearer secret'}});
 const response=await serve(req,assets);
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');assert.match(response.headers.get('Cache-Control'),/31536000.*immutable/);assert.equal(response.headers.get('Set-Cookie'),null);
 assert.equal(observed.headers.get('Cookie'),null);assert.equal(observed.headers.get('Authorization'),null);assert.equal(new URL(observed.url).pathname,manifest[key]);
 const head=await serve(new Request(req,{method:'HEAD'}),assets);assert.equal(await head.text(),'');
 const placeholder=await serve(new Request('https://lawvetter.test/api/chart-avatar/placeholder.webp'),assets);assert.equal(placeholder.headers.get('Cache-Control'),'public, max-age=300');
 for(const pathname of ['/account','/api/profile-photo?submission=private','/api/shortlist','/'])assert.equal(await serve(new Request('https://lawvetter.test'+pathname),assets),null);
});

test('Changed/new portraits fall back to current originals; invalid/private requests and missing assets cannot get immutable cached',async()=>{
 const {chartAvatarResponse:serve}=await load('worker/chart-avatars.ts');const bar='LV'+'f'.repeat(32);
 const fallback=await serve(new Request('https://lawvetter.test/api/chart-avatar/'+bar+'.pffffffff.webp'),{fetch(){throw Error('Unknown portraits must not fetch an asset');}});
 assert.equal(fallback.status,307);assert.equal(fallback.headers.get('Location'),'https://lawvetter.test/api/profile-photo?bar='+bar+'&v=pffffffff');assert.equal(fallback.headers.get('Cache-Control'),'no-store');
 const manifest=JSON.parse(fs.readFileSync('worker/chart-avatar-manifest.json','utf8')),key=Object.keys(manifest).find(k=>k!=='placeholder');
 const missing=await serve(new Request('https://lawvetter.test/api/chart-avatar/'+key+'.webp'),{fetch:async()=>new Response('<html>missing</html>',{status:404})});assert.equal(missing.status,307);assert.equal(missing.headers.get('Cache-Control'),'no-store');
 for(const suffix of ['submission.webp','placeholder.webp?submission=private','LVbad.p1.webp']){
  const response=await serve(new Request('https://lawvetter.test/api/chart-avatar/'+suffix),{});assert.equal(response.status,404);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 assert.equal((await serve(new Request('https://lawvetter.test/api/chart-avatar/placeholder.webp',{method:'POST'}),{})).status,405);
});

test('Optimized chart images have new immutable URLs while old cached documents retain their original image bytes',async()=>{
 const {chartAvatarResponse:serve}=await load('worker/chart-avatars.ts');
 const original=JSON.parse(fs.readFileSync('worker/chart-avatar-manifest.json','utf8'));
 const optimized=JSON.parse(fs.readFileSync('worker/chart-avatar-optimized-manifest.json','utf8'));
 const key=Object.keys(original).find(key=>key!=='placeholder'&&!key.includes('@'));
 let path;const assets={async fetch(request){path=new URL(request.url).pathname;return new Response('webp',{headers:{'Content-Type':'image/webp'}});}};
 await serve(new Request('https://lawvetter.test/api/chart-avatar/'+key+'.webp'),assets);assert.equal(path,original[key]);
 const newer=await serve(new Request('https://lawvetter.test/api/chart-avatar/'+key+'.v2.webp'),assets);assert.equal(path,optimized[key]);assert.notEqual(path,original[key]);assert.match(newer.headers.get('Cache-Control'),/31536000.*immutable/);
 const placeholder=await serve(new Request('https://lawvetter.test/api/chart-avatar/placeholder.v2.webp'),assets);assert.equal(path,optimized.placeholder);assert.match(placeholder.headers.get('Cache-Control'),/31536000.*immutable/);
 const sum=manifest=>Object.values(manifest).reduce((total,path)=>total+fs.statSync('public'+path).size,0);
 assert.ok(sum(optimized)<sum(original)*.4);
});


test('Chart controls retain their position while guest authentication is pending, and private shortlist links remain gated',async()=>{
 let account={loading:true,signedIn:false};
 const component=await load('app/Charts.tsx',{'./home-image':{homePortrait:()=>({src:'/portrait.webp'})},'react':React,'react/jsx-runtime':jsx,'./OwnershipSeal':{default:()=>null},'./FirmLogo':{default:()=>null},'./Shortlist':{SaveAttorneyButton:()=>null,useShortlist:()=>account},'./FirmLink':{FirmLink:()=>null},'./AttorneyReviewSummary':{default:()=>null}});
 const data={weekly:[],monthly:[],weeklyFirms:[],monthlyFirms:[],monthLabel:'October'};
 const render=()=>renderToStaticMarkup(React.createElement(component.Charts,{data,onOpen:()=>{}}));
 let html=render();assert.match(html,/class="chart-account-cta" aria-busy="true" aria-hidden="true" inert=""/);
 assert.match(html,/Create a profile to compare attorneys/);
 account={loading:false,signedIn:false};html=render();assert.match(html,/class="chart-account-cta" aria-busy="false"/);assert.doesNotMatch(html,/aria-hidden="true" inert/);
 account={loading:false,signedIn:true};assert.doesNotMatch(render(),/chart-account-cta/);
});

test('Chart photos and names open the same attorney through native links and the same click action',async()=>{
 const component=await load('app/Charts.tsx',{'./home-image':{homePortrait:()=>({src:'/portrait.webp'})},'react':{useState:value=>[value,()=>{}],useEffect:()=>{}},'react/jsx-runtime':jsx,'./OwnershipSeal':{default:()=>null},'./FirmLogo':{default:()=>null},'./Shortlist':{SaveAttorneyButton:()=>null,useShortlist:()=>({signedIn:false,loading:false})},'./FirmLink':{FirmLink:()=>null},'./AttorneyReviewSummary':{default:()=>null}});
 const attorney={bar_number:'LV'+'a'.repeat(32),name:'Example Attorney',state:'GA',city:'Atlanta',company:'Example Firm',rank:1,photo_key:'p123'};
 const opened=[],data={weekly:[attorney],monthly:[],weeklyFirms:[],monthlyFirms:[],monthLabel:'October'};
 const tree=component.Charts({data,onOpen:row=>opened.push(row)}),links=[];
 function walk(node){if(!node||typeof node!=='object')return;if(node.type==='a')links.push(node);for(const child of [node.props?.children].flat(Infinity))walk(child);}
 walk(tree);
 const photo=links.find(node=>node.props.className==='chart-avatar'),name=links.find(node=>node.props.className==='attorney-name-link');
 assert.ok(photo);assert.ok(name);assert.equal(photo.props.href,name.props.href);assert.match(photo.props['aria-label'],/View Example Attorney profile/);
 let prevented=0;photo.props.onClick({preventDefault(){prevented++;}});name.props.onClick({preventDefault(){prevented++;}});
 assert.equal(prevented,2);assert.deepEqual(opened,[attorney,attorney]);
});

test('Firm charts display uploaded banners and fallbacks with revision and lazy loading preserved',async()=>{
 const component=await load('app/Charts.tsx',{
  './home-image':{homePortrait:()=>({src:'/portrait.webp'})},
  'react':{useState:value=>[value==='attorneys'?'firms':value,()=>{}],useEffect:()=>{}},'react/jsx-runtime':jsx,
  './OwnershipSeal':{default:()=>null},'./Shortlist':{SaveAttorneyButton:()=>null,useShortlist:()=>({signedIn:true,loading:false})},
  './FirmLink':{FirmLink:({name,children})=>React.createElement('a',{href:'/firm?name='+encodeURIComponent(name)},children??name)},
  './FirmLogo':{default:({name,version,loading})=>React.createElement('img',{alt:name+' logo',src:'/banner?v='+version,loading})},
  './AttorneyReviewSummary':{default:()=>null}
 });
 const data={weekly:[],monthly:[],weeklyFirms:[{name:'Banner Firm',firm_key:'banner',rank:1,banner_version:'revision-2'},{name:'Text Firm',firm_key:'text',rank:2,banner_version:null}],monthlyFirms:[],monthLabel:'November'};
 const html=renderToStaticMarkup(component.Charts({data,onOpen:()=>{}}));
 assert.equal((html.match(/class="firm-chart-banner"/g)||[]).length,2);
 assert.match(html,/alt="Banner Firm logo"[^>]*src="\/banner\?v=revision-2"[^>]*loading="lazy"/);
 assert.match(html,/Text Firm/);assert.match(html,/alt="Text Firm logo"[^>]*loading="lazy"/);
});

test('The full monthly panel stays on Charts and the homepage carousel knows which attorney is featured in the hero',async()=>{
 const winner={bar_number:'monthly-winner',name:'Monthly Leader',city:'Miami',state:'FL',rank:1,photo_key:'portrait'};
 const data={weekly:[winner],monthly:[winner],weeklyFirms:[],monthlyFirms:[],monthLabel:'November 2026'};
 const stubs={react:React,'react/jsx-runtime':jsx,'./home-image':{homePortrait:()=>({src:'/portrait.webp'})},'./OwnershipSeal':{default:()=>null},'./FirmLogo':{default:()=>null},'./Shortlist':{SaveAttorneyButton:()=>null,useShortlist:()=>({signedIn:true,attorneys:[],loading:false})},'./FirmLink':{FirmLink:()=>null},'./AttorneyReviewSummary':{default:()=>null}};
 const chart=await load('app/Charts.tsx',stubs);
 const html=renderToStaticMarkup(React.createElement(chart.Charts,{data,onOpen:()=>{}}));
 assert.match(html,/This month’s leading lawyer/);assert.match(html,/Monthly Leader/);assert.match(html,/Miami, Florida/);
 assert.ok(html.indexOf('monthly-leading-lawyer-title')<html.indexOf('class="chart-controls"'),'The panel precedes the ranking controls');
 let carousel;
 const home=await load('app/DiscoveryHome.tsx',{...stubs,'./DiscoveryCarousels':{PopularAttorneys:props=>{carousel=props;return React.createElement('div',null,'Weekly attorneys');}}});
 const homepage=renderToStaticMarkup(React.createElement(home.DiscoveryHome,{data,onOpen:()=>{},onView:()=>{},onPractice:()=>{}}));
 assert.doesNotMatch(homepage,/This month’s leading lawyer|monthly-spotlight/);assert.match(homepage,/Most searched attorneys/);
 assert.equal(carousel.featuredAttorneyId,winner.bar_number);assert.equal(carousel.attorneys[0].bar_number,winner.bar_number);
});
