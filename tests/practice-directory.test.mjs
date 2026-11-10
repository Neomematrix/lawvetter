import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

async function loadComponent(file,context,stubs){
 Object.assign(context,{setTimeout,clearTimeout,AbortController});stubs={'next/navigation':{usePathname:()=>context.window?.location.pathname||'/'},...stubs};const cache=new Map();async function module(file){if(cache.has(file))return cache.get(file);if(file.endsWith('.css')){return new vm.SyntheticModule([],function(){},{context});}if(stubs[file]){const values=stubs[file],m=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});cache.set(file,m);return m;}
 const code=ts.transpileModule(fs.readFileSync(fs.existsSync(file)?file:file.replace(/\.ts$/,'.tsx'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,m=new vm.SourceTextModule(code,{context,identifier:file});cache.set(file,m);return m;}
 const m=await module(path.resolve(file));await m.link((spec,parent)=>module(stubs[spec]?spec:path.resolve(path.dirname(parent.identifier),spec)+(spec.endsWith('.css')?'':'.ts')));await m.evaluate();return m.namespace;
}
test('Practice search sends the attorney name and location together, retains them in its URL and clears all filters',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/practice-areas/family-law?q=Alex%20Smith&city=Atlanta&zip=30303'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const calls=[],context=vm.createContext({window:dom.window,URLSearchParams,AbortController});
 const component=await loadComponent('app/PracticeDirectory.tsx',context,{'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:()=>null},'./seo':{attorneyPath:()=>'/lawyers/test'},'./attorney-request':{requestAttorneyData:async params=>{calls.push(params);return {attorneys:[],total:0};}}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{area:{id:'family-law',name:'Family law'}})));assert.equal(calls.at(-1).q,'Alex Smith');assert.equal(calls.at(-1).practice,'family-law');
 const input=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Attorney name')).querySelector('input'),setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
 await React.act(async()=>{setter.call(input,'Jordan Family');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(calls.at(-1).q,'Jordan Family');assert.equal(calls.at(-1).city,'Atlanta');assert.equal(calls.at(-1).zip,'30303');assert.equal(calls.at(-1).practice,'family-law');assert.equal(new URL(dom.window.location.href).searchParams.get('q'),'Jordan Family');
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Clear filters').click());assert.equal(calls.at(-1).q,'');assert.equal(calls.at(-1).city,'');assert.equal(calls.at(-1).zip,'');assert.equal(calls.at(-1).practice,'family-law');assert.equal(dom.window.location.search,'');assert.equal(input.value,'');await historyStep(dom,'back');assert.equal(calls.at(-1).q,'Jordan Family');assert.equal(input.value,'Jordan Family');assert.equal(calls.at(-1).city,'Atlanta');assert.equal(calls.at(-1).zip,'30303');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
test('Ranking practice labels are individual links to their categories and respect owner edits',async()=>{
 const context=vm.createContext({}),component=await loadComponent('app/Charts.tsx',context,{'./home-image':{homePortrait:()=>({src:'/portrait.webp'})},'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:()=>null},'./Shortlist':{SaveAttorneyButton:()=>null,useShortlist:()=>({loading:true,signedIn:false})},'./FirmLink':{FirmLink:()=>null},'./DiscoveryCarousels':{PopularAttorneys:()=>null},'./AttorneyReviewSummary':{default:()=>null}});
 const attorneys=[{bar_number:'100001',name:'Alex Smith',city:'Atlanta',state:'GA',rank:1,practice_areas:'Family law, Litigation'}, {bar_number:'238455',name:'Edited Attorney',city:'Atlanta',state:'GA',rank:2,owner_edited:1,practice_areas:'Business law'}];const html=renderToStaticMarkup(React.createElement(component.Charts,{data:{weekly:attorneys,monthly:[],weeklyFirms:[],monthlyFirms:[],monthLabel:'October'},onOpen:()=>{}}));
 assert.match(html,/href="\/practice-areas\/family-law"/);assert.match(html,/href="\/practice-areas\/litigation"/);assert.match(html,/href="\/practice-areas\/business-law"/);assert.equal((html.match(/href="\/practice-areas\/family-law"/g)||[]).length,1);
});

async function historyStep(dom,direction){await React.act(async()=>{await new Promise(resolve=>{dom.window.addEventListener('popstate',()=>resolve(),{once:true});dom.window.history[direction]();});});}
test('Directory history restores menus, search terms and result pages, while profile clicks navigate to a real profile URL',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const a={bar_number:'100001',name:'Alex Morgan Smith',city:'Atlanta',state:'GA',status:'Active Member in Good Standing'},calls=[],navigations=[];
 const fakeWindow={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),dispatchEvent:dom.window.dispatchEvent.bind(dom.window),history:dom.window.history,location:{get search(){return dom.window.location.search;},get hash(){return dom.window.location.hash;},assign(url){navigations.push(url);}},addEventListener:dom.window.addEventListener.bind(dom.window),removeEventListener:dom.window.removeEventListener.bind(dom.window),scrollTo(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 const context=vm.createContext({window:fakeWindow,document:dom.window.document,URLSearchParams,AbortController,CustomEvent:dom.window.CustomEvent,crypto:globalThis.crypto});
 const directory={AttorneyCard:({onOpen})=>React.createElement('button',{onClick:()=>onOpen(a)},'Open result profile'),Charts:({onOpen})=>React.createElement('button',{onClick:()=>onOpen(a)},'Open chart profile'),DiscoveryHome:()=>React.createElement('div',null,'Discovery home'),ShortlistPage:()=>null};
 const component=await loadComponent('app/HomeClient.tsx',context,{'react':React,'react/jsx-runtime':jsx,'./DirectoryContent':{default:({view,...props})=>React.createElement(view==='charts'?directory.Charts:view==='shortlist'?directory.ShortlistPage:directory.DiscoveryHome,props)},'./AttorneyCard':{AttorneyCard:directory.AttorneyCard},'./ResponsiveHeader':{default:({onNavigate})=>React.createElement('nav',null,React.createElement('button',{onClick:()=>onNavigate('charts')},'Charts menu'),React.createElement('button',{onClick:()=>onNavigate('discover')},'Discover menu'))},'./AttorneyNameInput':{default:({value,onChange})=>React.createElement('input',{'aria-label':'Attorney name',value,onChange:e=>onChange(e.target.value)})},'./SearchAdvertisement':{default:()=>null,activeSearchSponsor:()=>false},'./FirmLink':{FirmLink:()=>null},'./Shortlist':{ShortlistNotice:()=>null},'./HomepageLocationInput':{default:()=>React.createElement('input',{name:'location'})},'./LandingHero':{default:({search})=>search},'./attorney-request':{requestAttorneyData:async query=>{calls.push(query);return query.id?{attorney:a}:{attorneys:[a],total:30,page:query.page};}}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{initialHome:{weekly:[],monthly:[]}})));const length=dom.window.history.length;
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Charts menu').click());assert.equal(dom.window.history.length,length+1);assert.match(dom.window.location.search,/view=charts/);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Open chart profile').click());assert.equal(navigations[0],'/attorney?bar=100001&returnTo=%2F%3Fview%3Dcharts');
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Discover menu').click());const input=document.querySelector('[aria-label="Attorney name"]'),setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
 await React.act(async()=>{setter.call(input,'Alex Smith');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(navigations.at(-1),'/discover?q=Alex+Smith&status=active');
 await React.act(async()=>{dom.window.history.pushState({},'',navigations.at(-1));dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));});assert.equal(calls.at(-1).q,'Alex Smith');
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Next').click());assert.equal(new URL(dom.window.location.href).searchParams.get('page'),'2');assert.equal(calls.at(-1).page,2);
 await historyStep(dom,'back');assert.equal(calls.at(-1).page,1);assert.equal(document.querySelector('[aria-label="Attorney name"]').value,'Alex Smith');assert.match(document.body.textContent,/Page 1 of 2/);
 await historyStep(dom,'back');assert.equal(dom.window.location.search,'');assert.match(document.body.textContent,/Discovery home/);
 await historyStep(dom,'forward');assert.equal(calls.at(-1).q,'Alex Smith');assert.match(document.body.textContent,/Page 1 of 2/);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Open result profile').click());assert.equal(navigations.at(-1),'/attorney?bar=100001');assert.equal(calls.at(-1).id,'100001');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
test('Claim disclosure opens, reports errors, submits identity details and shows the pending review state',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/account'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const calls=[];let fail=true;const component=await loadComponent('app/ClaimProfile.tsx',vm.createContext({Error}),{'react':React,'react/jsx-runtime':jsx,'./profile-request':{profileRequest:async data=>({emailStatus:'accepted'}),profileClaimRequest:async data=>{calls.push(data);if(fail)throw Error('Verification service unavailable. Try again.');return {status:'pending'};}}});
 function Harness(){const [state,setState]=React.useState({signedIn:true,isOwner:false,isAdmin:false,profile:null,claim:null});return React.createElement(component.default,{bar:'100001',name:'Alex Morgan Smith',state,onRefresh:()=>setState({...state,claim:{status:'pending',review_note:''}})});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(Harness)));const details=document.querySelector('details');assert.equal(details.open,false);await React.act(async()=>document.querySelector('summary').click());assert.equal(details.open,true);assert.equal(document.querySelector('input:not([type=checkbox])').value,'Alex Morgan Smith');
 const email=document.querySelector('input[type=email]'),inputSetter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;await React.act(async()=>{inputSetter.call(email,'alex@firm.example.test');email.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});const text=document.querySelector('textarea'),setter=Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set;await React.act(async()=>{setter.call(text,'My official firm biography and my firm email verify my identity.');text.dispatchEvent(new dom.window.Event('input',{bubbles:true}));document.querySelector('input[type=checkbox]').click();});
 const submit=async()=>React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));await submit();assert.match(document.querySelector('[role=alert]').textContent,/Verification service unavailable/);assert.equal(details.open,true);
 fail=false;await submit();assert.equal(calls.at(-1).action,'claim');assert.equal(calls.at(-1).bar,'100001');assert.equal(calls.at(-1).fullName,'Alex Morgan Smith');assert.equal(calls.at(-1).attestation,true);assert.equal(calls.at(-1).firmEmail,'alex@firm.example.test');assert.match(document.body.textContent,/claim is awaiting review/);assert.equal(document.querySelector('details'),null);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('Owned account hides completed claim tools, shows real analytics at the right and closes its editor after saving',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/account'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 let profile={bar_number:'100001',name:'Alex Smith',company:'Firm',state:'GA',headline:'Original headline',bio:'Original biography',practice_areas:'Family law',website:'',photo_key:'',claimed_at:'now',updated_at:'now'};const calls=[];
 const context=vm.createContext({window:dom.window,Error,URLSearchParams,requestAnimationFrame:fn=>{fn();return 1;},fetch:async()=>Response.json({profiles:[{bar_number:'100001',monthlyRank:8,views:12}],monthLabel:'October'})});
 const component=await loadComponent('app/account/AttorneyAccount.tsx',context,{'../ActivityPanel':{default:()=>null},'react':React,'react/jsx-runtime':jsx,'../SiteHeader':{default:()=>null},'./NewAttorneyProfile':{default:()=>null},'./AttorneyReferrals':{default:()=>null},'../ClaimProfile':{default:()=>null},'../profile-request':{profileRequest:async data=>{calls.push(data);if(data.action==='save'){profile={...profile,headline:data.headline,bio:data.bio,practice_areas:data.practiceAreas,website:data.website};return {saved:true};}return {profiles:[{...profile}],claims:[],submissions:[],isAdmin:false};}}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{onLogout:()=>{},logoutBusy:false})));assert.equal(document.querySelector('#claim-profile-search'),null);await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Analytics').click());assert.equal(document.querySelector('#my-lawyer-analytics').hidden,false);await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='My profile').click());assert.equal(document.querySelector('.profile-editor form'),null);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Edit profile').click());const input=[...document.querySelectorAll('.profile-editor label')].find(l=>l.textContent==='Professional headline').querySelector('input'),setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;await React.act(async()=>{setter.call(input,'Updated professional headline');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await React.act(async()=>document.querySelector('.profile-editor form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(calls.find(c=>c.action==='save').headline,'Updated professional headline');assert.equal(document.querySelector('.profile-editor form'),null);assert.ok(document.querySelector('.compact-profile-strip'));assert.equal(document.querySelector('.saved-attorney-profile'),null);assert.equal(document.querySelector('.photo-editor'),null);assert.equal(document.querySelector('.dashboard-save-message').textContent,'Profile saved.');await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Edit profile').click());assert.equal(document.querySelector('.compact-profile-strip'),null);assert.equal([...document.querySelectorAll('.profile-editor label')].find(l=>l.textContent==='Professional headline').querySelector('input').value,'Updated professional headline');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('Attorney cards show the compact branded owl only for approved ownership',async()=>{
 const component=await loadComponent('app/AttorneyCard.tsx',vm.createContext({}),{'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:()=>null},'./Shortlist':{SaveAttorneyButton:()=>null,useShortlist:()=>({loading:true,signedIn:false})},'./FirmLink':{FirmLink:()=>null},'./DiscoveryCarousels':{PopularAttorneys:()=>null},'./AttorneyReviewSummary':{default:()=>null}});
 const attorney={bar_number:'100001',name:'Alex Smith',city:'Atlanta',state:'GA',status:'Active Member in Good Standing'},render=value=>new JSDOM(renderToStaticMarkup(React.createElement(component.AttorneyCard,{attorney:{...attorney,ownership_verified:value},onOpen:()=>{}})));
 const verified=render(1);assert.equal(verified.window.document.querySelector('.ownership-seal').getAttribute('aria-haspopup'),'dialog');assert.equal(verified.window.document.querySelector('.ownership-seal img').getAttribute('src'),'/brand/lawvetter-icon.svg');assert.equal(verified.window.document.querySelector('.verified-ownership-compact small'),null);verified.window.close();
 for(const value of [undefined,0]){const unverified=render(value);assert.equal(unverified.window.document.querySelector('.ownership-seal'),null);unverified.window.close();}
});

test('Client dashboard links the owned attorney profile separately from verified client relationships',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/client-reviews'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const context=vm.createContext({window:dom.window,document:dom.window.document,URLSearchParams,URL,fetch:async()=>Response.json({})});
 const component=await loadComponent('app/client-reviews/ClientReviewAccount.tsx',context,{'react':React,'react/jsx-runtime':jsx,'./ReviewEditor':{default:()=>null},'../client-review-request':{clientReviewRequest:async()=>({profile:{legal_name:'Kyle Test',email:'owner@example.test'},signedInEmail:'owner@example.test',requests:[],isAdmin:false})},'../profile-request':{profileRequest:async()=>({profiles:[{bar_number:'4444',name:'Kyle Test',state:'GA',company:'Firm',claimed_at:'now',photo_key:''}]})},'../LocationAutocomplete':{default:()=>null},'../location-options':{countyOptions:()=>[],courtOptions:()=>[]}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{bar:''})));assert.equal(document.querySelector('h1').textContent,'My attorneys');assert.equal([...document.querySelectorAll('a')].find(a=>a.textContent==='My lawyer account').getAttribute('href'),'/account');assert.match(document.body.textContent,/Your attorneys will appear here/);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('Signed-in navigation points to Dashboard and switches back to Login after the session ends',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let signedIn=true;
 const component=await loadComponent('app/ClientAccountNav.tsx',vm.createContext({window:dom.window,fetch:async()=>Response.json({client:signedIn?{email:'owner@example.test'}:null})}),{'react':React,'react/jsx-runtime':jsx});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default)));assert.equal(document.querySelector('a').textContent,'Dashboard');assert.equal(document.querySelector('a').getAttribute('href'),'/dashboard');assert.ok(document.querySelector('a svg'));signedIn=false;await React.act(async()=>dom.window.dispatchEvent(new dom.window.Event('client-auth-changed')));assert.equal(document.querySelector('a').textContent,'Login');assert.equal(document.querySelector('a').getAttribute('href'),'/client-reviews');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('Attorney referral inbox shows the requested contact fields, copies its direct link and persists read and follow-up changes',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/account'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let referral={id:'referral-one',name:'Client Example',email:'client@example.test',phone:'404-555-0100',city:'Atlanta, GA',practice:'family-law',summary:'How can I arrange custody and support for my child?',contact_method:'email',urgency:'urgent',status:'new',created_at:'2026-10-13T22:00:00Z',attorney_read_at:null};const posts=[],copied=[],metrics=[];
 const component=await loadComponent('app/account/AttorneyReferrals.tsx',vm.createContext({window:dom.window,document:dom.window.document,AbortController,navigator:{clipboard:{writeText:async value=>copied.push(value)}},Error,fetch:async(url,options={})=>{if(options.method==='POST'){const body=JSON.parse(options.body);posts.push(body);referral={...referral,...(body.action==='read'?{attorney_read_at:'now'}:{status:body.status})};return Response.json({saved:true});}assert.equal(url,'/api/account/referrals?bar=4444&page=1');return Response.json({referrals:[referral],metrics:{total:1,unread:referral.attorney_read_at?0:1,urgent:1},page:1});}}),{'react':React,'react/jsx-runtime':jsx});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{bar:'4444',name:'Kyle Test',onMetrics:value=>metrics.push(value)})));assert.match(document.body.textContent,/Client Example/);assert.match(document.body.textContent,/client@example.test/);assert.match(document.body.textContent,/404-555-0100/);assert.match(document.body.textContent,/How can I arrange custody/);assert.equal(document.querySelector('.referral-urgency').textContent,'Urgent');
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Share referral link').click());assert.equal(copied[0],'https://lawvetter.test/hire-lawyer?attorney=4444');
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Mark read').click());assert.equal(posts[0].id,'referral-one');assert.equal(posts[0].action,'read');assert.equal(document.querySelector('.referral-new'),null);assert.equal(metrics.at(-1).unread,0);
 await React.act(async()=>{const select=document.querySelector('.mailbox-open-message select');select.value='contacted';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(posts.at(-1).status,'contacted');assert.equal(document.querySelector('.mailbox-open-message select').value,'contacted');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('Direct referral form sends the selected attorney, client details, question after human verification',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/hire-lawyer?attorney=4444'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const posts=[];
 const captcha=({onReady})=>{React.useEffect(()=>onReady(true),[onReady]);return React.createElement('input',{type:'hidden',name:'captchaToken',value:'verified-fixture',readOnly:true});};
 const component=await loadComponent('app/hire-lawyer/Intake.tsx',vm.createContext({window:dom.window,FormData:dom.window.FormData,crypto:globalThis.crypto,AbortController,Error,fetch:async(url,options={})=>{if(options.method==='POST'){posts.push(JSON.parse(options.body));return Response.json({ok:true,id:posts.at(-1).id}, {status:201});}return Response.json({areas:[]});}}),{'react':React,'react/jsx-runtime':jsx,'../SiteHeader':{default:()=>null},'../DirectoryCaptcha':{default:captcha},'../CityStateAutocomplete':{default:()=>React.createElement('input',{type:'hidden',name:'city',value:'Atlanta, GA',readOnly:true})},'../inquiry-tracking':{inquiryVisitor:()=>'',trackInquiry:()=>{}}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{attorney:{bar:'4444',name:'Kyle Test',verified:true}})));assert.equal(document.querySelector('[name="phone"]').required,true);assert.match(document.body.textContent,/directly to this attorney’s private LawVetter inbox/);const form=document.querySelector('form');form.elements.name.value='Client Example';form.elements.email.value='client@example.test';form.elements.phone.value='4045550100';form.elements.practice.value='other';assert.equal(form.elements.urgency,undefined);form.elements.consent.checked=true;
 const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set;await React.act(async()=>{setter.call(form.elements.summary,'How can I arrange custody and support for my child?');form.elements.summary.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await React.act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(posts.length,1);assert.equal(posts[0].attorneyBar,'4444');assert.equal(posts[0].name,'Client Example');assert.equal(posts[0].email,'client@example.test');assert.equal(posts[0].phone,'4045550100');assert.ok(!posts[0].urgency);assert.equal(posts[0].captchaToken,'verified-fixture');assert.equal(posts[0].consent,true);assert.match(document.body.textContent,/Kyle Test’s private inbox/);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('Server-rendered practice cards and biographies are present before browser effects run',async()=>{
 const stubs={'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:({attorney})=>React.createElement('a',{href:'/lawyers/'+attorney.bar_number},attorney.name)}};const component=await loadComponent('app/PracticeDirectory.tsx',vm.createContext({}),stubs),html=renderToStaticMarkup(React.createElement(component.default,{area:{id:'family-law',name:'Family law'},initialResult:{attorneys:[{bar_number:'100001',name:'Visible Attorney'}],total:1}}));assert.match(html,/Visible Attorney/);assert.match(html,/href="\/lawyers\/100001"/);assert.ok(!html.includes('Finding attorneys'));
});

test('Analytics tracks public navigation without form query values and skips private routes and privacy opt-outs',async()=>{
 const component=await loadComponent('app/GoogleAnalytics.tsx',vm.createContext({}),{'react/jsx-runtime':jsx}),html=renderToStaticMarkup(React.createElement(component.default,{measurementId:'G-ABCDE12345'})),code=html.match(/<script>([\s\S]*)<\/script>/)[1];const dom=new JSDOM('<head></head>',{url:'https://lawvetter.test/?email=PRIVATE-EMAIL',runScripts:'outside-only'});try{dom.window.eval(code);let events=dom.window.dataLayer.map(a=>[...a]);assert.equal(events.filter(a=>a[1]==='page_view').length,1);assert.ok(!JSON.stringify(events).includes('PRIVATE-EMAIL'));dom.window.history.pushState({},'','/account/verify-email?token=PRIVATE-TOKEN');assert.equal(dom.window.dataLayer.map(a=>[...a]).filter(a=>a[1]==='page_view').length,1);dom.window.history.pushState({},'','/practice-areas/family-law?email=PRIVATE-EMAIL');events=dom.window.dataLayer.map(a=>[...a]);assert.equal(events.filter(a=>a[1]==='page_view').length,2);assert.ok(!JSON.stringify(events).includes('PRIVATE-TOKEN'));assert.ok(!JSON.stringify(events).includes('PRIVATE-EMAIL'));}finally{dom.window.close();}
 const privateBrowser=new JSDOM('<head></head>',{url:'https://lawvetter.test/',runScripts:'outside-only'});try{Object.defineProperty(privateBrowser.window.navigator,'globalPrivacyControl',{value:true});privateBrowser.window.eval(code);assert.equal(privateBrowser.window.dataLayer,undefined);assert.equal(privateBrowser.window.document.querySelector('script'),null);}finally{privateBrowser.window.close();}
});

 test('Employment and benefits share one category and include existing benefits attorneys',async()=>{
 const category=await loadComponent('app/practice-category.ts',vm.createContext({}),{});
 for(const label of ['Employment Law','Employment & Benefits','employment-and-benefits','Employment Benefits','Employee Benefits'])assert.equal(category.practiceCategoryId(label),'employment-law');
 const areas=category.categoryList(['Employment & Benefits','Employment Law','Employee Benefits']);
 assert.equal(areas.filter(a=>a.id==='employment-law').length,1);
 assert.ok(!areas.some(a=>a.id==='employment-and-benefits'));
 assert.deepEqual(Array.from(category.splitPracticeAreas('Employment & Benefits, Employment Law, Family law')),['Employment Law','Family law']);
 const catalogModule=await loadComponent('db/practice-categories.ts',vm.createContext({}),{'./judicial-category-rollback':{ensureJudicialCategoryRollback:async()=>{}},'./verified-judicial-categories':{ensureVerifiedJudicialCategories:async()=>{}}});
 const catalog=await catalogModule.practiceCatalog({prepare:()=>({all:async()=>({results:[{bar_number:'100001',practice_areas:'Employment & Benefits'},{bar_number:'100002',practice_areas:'Employment Law'}]})})});
 assert.deepEqual(Array.from(catalog.bars.get('employment-law')).sort(),['100001','100002']);
 });

test('Judicial review eligibility follows the exact Judge practice category',async()=>{
 const {isJudicialProfile}=await loadComponent('db/judicial-profile.ts',vm.createContext({}),{});
 for(const [areas,expected] of [['Judge',true],['Family law; JUDGE',true],['Former Judge',false],['Family law',false],['',false],[null,false]]){
  const db={prepare:()=>({bind:bar=>{assert.equal(bar,'100001');return {first:async()=>areas===null?null:{practice_areas:areas}};}})};
  assert.equal(await isJudicialProfile(db,'100001'),expected);
 }
});

test('Judicial rollback removes only the bulk tags and preserves manual profiles and other fields',async()=>{
 const {DatabaseSync}=await import('node:sqlite'),sqlite=new DatabaseSync(':memory:');
 sqlite.exec("CREATE TABLE attorney_profiles(bar_number TEXT PRIMARY KEY,owner_id TEXT,bio TEXT,practice_areas TEXT,website TEXT,photo_key TEXT,updated_at TEXT); CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);");
 sqlite.prepare('INSERT INTO site_settings VALUES(?,?,?)').run('judge-category-backfill-2026-10-18',JSON.stringify({status:'complete'}),'old');
 for(const [bar,practice] of [['1','Judge'],['2','Employment & Benefits, Judge, Litigation'],['3','Family law'],['manual','Judge']])sqlite.prepare('INSERT INTO attorney_profiles VALUES(?,?,?,?,?,?,?)').run(bar,'owner','Bio',practice,'https://court.test','photo','old');
 const db={prepare(sql){return {values:[],bind(...values){this.values=values;return this;},async first(){return sqlite.prepare(sql).get(...this.values)||null;},async all(){return {results:sqlite.prepare(sql).all(...this.values)};},async run(){return {meta:{changes:sqlite.prepare(sql).run(...this.values).changes}};}};},async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results;}};
 const module=await loadComponent('db/judicial-category-rollback.ts',vm.createContext({crypto}),{'./judicial-category-rollback-targets':{judicialRollbackBars:['1','2','3']}});
 await module.ensureJudicialCategoryRollback(db);
 assert.equal(sqlite.prepare("SELECT practice_areas FROM attorney_profiles WHERE bar_number='1'").get().practice_areas,'');
 const profile=sqlite.prepare("SELECT * FROM attorney_profiles WHERE bar_number='2'").get();assert.equal(profile.practice_areas,'Employment & Benefits, Litigation');assert.equal(profile.owner_id,'owner');assert.equal(profile.bio,'Bio');assert.equal(profile.website,'https://court.test');assert.equal(profile.photo_key,'photo');
 assert.equal(sqlite.prepare("SELECT practice_areas FROM attorney_profiles WHERE bar_number='manual'").get().practice_areas,'Judge');
 assert.equal(sqlite.prepare("SELECT practice_areas FROM attorney_profiles WHERE bar_number='3'").get().practice_areas,'Family law');
 const report=JSON.parse(sqlite.prepare("SELECT value FROM site_settings WHERE key='judge-category-rollback-2026-10-18'").get().value);assert.equal(report.removed,2);assert.equal(report.alreadyRemoved,1);
 sqlite.prepare("UPDATE attorney_profiles SET practice_areas='Judge' WHERE bar_number='1'").run();await module.ensureJudicialCategoryRollback(db);assert.equal(sqlite.prepare("SELECT practice_areas FROM attorney_profiles WHERE bar_number='1'").get().practice_areas,'Judge');sqlite.close();
});


test('Practice pagination uses full 24-card pages and scrolls to the new results after loading, including Previous',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/practice-areas/personal-injury'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const scrolls=[],calls=[];let finish;
 dom.window.HTMLElement.prototype.scrollIntoView=function(options){scrolls.push({text:this.textContent,options});};
 const attorneys=Array.from({length:24},(_,i)=>({bar_number:String(i),name:'Attorney '+i}));
 const component=await loadComponent('app/PracticeDirectory.tsx',vm.createContext({window:dom.window,URLSearchParams,AbortController}),{'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:({attorney})=>React.createElement('article',null,attorney.name)},'./seo':{attorneyPath:()=>'/lawyers/test'},'./attorney-request':{requestAttorneyData:params=>{calls.push(params);return new Promise(resolve=>{finish=resolve;});}}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{area:{id:'personal-injury',name:'Personal injury'},initialResult:{attorneys,total:50}})));
 assert.equal(document.querySelectorAll('.results-card-grid article').length,24);assert.match(document.body.textContent,/Page 1 of 3/);assert.equal(scrolls.length,0);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Next').click());
 assert.equal(calls.at(-1).page,2);assert.equal(dom.window.location.search,'?page=2');assert.equal(scrolls.length,0);
 await React.act(async()=>finish({attorneys:attorneys.map(a=>({...a,name:'Page two '+a.name})),total:50}));
 assert.equal(scrolls.length,1);assert.match(scrolls[0].text,/Page two Attorney/);assert.equal(scrolls[0].options.block,'start');assert.match(document.body.textContent,/Page 2 of 3/);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Previous').click());
 assert.equal(document.querySelectorAll('.results-card-grid article').length,24);assert.equal(dom.window.location.search,'');assert.equal(scrolls.length,2);assert.match(scrolls[1].text,/Attorney 0/);assert.doesNotMatch(scrolls[1].text,/Page two/);
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('ZIP distance selector defaults to 50 miles, narrows the search and survives pagination and browser history',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/practice-areas/family-law?zip=30127'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const calls=[],attorneys=[{bar_number:'1',name:'Nearby Attorney'}];
 const component=await loadComponent('app/PracticeDirectory.tsx',vm.createContext({window:dom.window,URLSearchParams,AbortController}),{'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:({attorney})=>React.createElement('article',null,attorney.name)},'./seo':{attorneyPath:()=>'/lawyers/test'},'./attorney-request':{requestAttorneyData:async params=>{calls.push(params);return {attorneys,total:50};}}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(component.default,{area:{id:'family-law',name:'Family law'}})));
 const select=document.querySelector('select');assert.equal(select.value,'50');assert.equal(calls.at(-1).radius,50);assert.match(document.body.textContent,/Within 50 miles of 30127/);
 await React.act(async()=>{select.value='10';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(calls.at(-1).radius,10);assert.equal(calls.at(-1).page,1);assert.equal(new URLSearchParams(dom.window.location.search).get('radius'),'10');
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Next').click());assert.equal(calls.at(-1).radius,10);assert.equal(calls.at(-1).page,2);
 await historyStep(dom,'back');assert.equal(calls.at(-1).page,1);assert.equal(select.value,'10');await historyStep(dom,'back');assert.equal(select.value,'50');assert.equal(calls.at(-1).radius,50);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Clear filters').click());assert.equal(select.value,'50');assert.equal(select.disabled,true);assert.equal(calls.at(-1).zip,'');assert.equal(dom.window.location.search,'');
 }finally{await React.act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('city landing pages retain exact city on hydration, clearing and browser history',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://lawvetter.test/lawyers-in/atlanta-ga/family-law?city=Miami%2C%20FL&q=Smith'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const calls=[],context=vm.createContext({window:dom.window,URLSearchParams,AbortController});
 const component=await loadComponent('app/PracticeDirectory.tsx',context,{'react':React,'react/jsx-runtime':jsx,'./AttorneyCard':{AttorneyCard:()=>null},'./seo':{attorneyPath:()=>'/lawyers/test'},'./attorney-request':{requestAttorneyData:async params=>{calls.push(params);return {attorneys:[],total:0};}}});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(React.createElement(component.default,{area:{id:'family-law',name:'Family law'},fixedCity:'Atlanta, GA',initialQuery:{q:'',city:'Atlanta, GA',zip:'',page:1}})));
 assert.equal(calls.at(-1).city,'Atlanta, GA');assert.equal(calls.at(-1).exactCity,'1');assert.equal(document.querySelector('[name="city"]').readOnly,true);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Clear filters').click());assert.equal(calls.at(-1).city,'Atlanta, GA');assert.equal(calls.at(-1).q,'');
 await historyStep(dom,'back');assert.equal(calls.at(-1).city,'Atlanta, GA');assert.equal(calls.at(-1).q,'Smith');
 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});
