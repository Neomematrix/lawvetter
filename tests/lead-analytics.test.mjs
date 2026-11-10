import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const id='12345678-1234-4234-8234-123456789abc';
async function fixture({storage=new Map(),blockedStorage=false,privacy=false,attorney}={}){
 const events=[],requests=[],state=[];let cursor=0,respond;
 const localStorage={getItem:key=>{if(blockedStorage)throw Error();return storage.get(key)||null;},setItem:(key,value)=>{if(blockedStorage)throw Error();storage.set(key,value);}};
 const window={gtag:(...args)=>events.push(args)};
 const context=vm.createContext({window,navigator:{doNotTrack:privacy?'1':'0'},localStorage,location:{origin:'https://lawvetter.com',search:'?email=private@example.com'},crypto:{randomUUID:()=>id},FormData:class{constructor(){}* [Symbol.iterator](){yield* [['name','Private Name'],['email','private@example.com'],['summary','Private legal details'],['consent','on']];}get(key){return key==='consent'?'on':null;}},fetch:async(url,options)=>{requests.push({url,options});return await new Promise(resolve=>{respond=resolve;});}});
 const hooks={useState:initial=>{const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useRef:initial=>{const index=cursor++;return state[index]??=( {current:initial});},useEffect:()=>{}};
 const jsx=(type,props)=>({type,props});const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'../phone-format':{formatPhoneEvent:()=>{}},'../referral-urgency':{referralUrgencies:[]},'../CityStateAutocomplete':{default:'CityStateAutocomplete'},'../form-words':{wordCount:value=>value.trim().split(/\s+/).filter(Boolean).length,minimumSituationWords:8},'../SiteHeader':{default:'SiteHeader'},'./ReferralConfirmation':{default:'ReferralConfirmation'},'../DirectoryCaptcha':{default:'DirectoryCaptcha'},'../practice-catalog':{practiceAreas:[]}};
 const cache=new Map();async function load(name,file){if(cache.has(name))return cache.get(name);let mod;if(mocks[name]){const values=mocks[name];mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});}else{const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;mod=new vm.SourceTextModule(code,{context});}cache.set(name,mod);await mod.link(spec=>load(spec,spec==='../inquiry-tracking'?'app/inquiry-tracking.ts':undefined));await mod.evaluate();return mod;}
 const tracking=(await load('../inquiry-tracking','app/inquiry-tracking.ts')).namespace;
 const Intake=(await load('Intake','app/hire-lawyer/Intake.tsx')).namespace.default;
 const render=()=>{cursor=0;return Intake({attorney});};
 function find(node,type){if(!node||typeof node!=='object')return; if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(child,type);if(result)return result;}}
 const ready=()=>{let tree=render();find(tree,'DirectoryCaptcha').props.onReady(true);find(tree,'textarea').props.onChange({target:{value:'I need help with a legal matter today.',setCustomValidity(){}}});return render();};
 return {events,requests,tracking,window,render,ready,find,submit:tree=>find(tree,'form').props.onSubmit({preventDefault(){},currentTarget:{}}),reply:body=>respond(body)};
}
test('opening and starting form send no lead; failed or unconfirmed saves send no lead',async()=>{
 const f=await fixture();f.render();const tree=f.ready();assert.equal(f.events.length,0);
 for(const response of [{ok:false,json:async()=>({error:'Save failed'})},{ok:true,json:async()=>({ok:false})},{ok:true,json:async()=>({ok:true,id:'wrong'})}]){const pending=f.submit(tree);assert.equal(f.events.length,0);f.reply(response);await pending;assert.equal(f.events.length,0);}
});
test('confirmed save emits once, blocks double submits, and retries use the same ID',async()=>{
 const f=await fixture();let tree=f.ready();const failed=f.submit(tree);f.reply({ok:false,json:async()=>({error:'offline'})});await failed;
 tree=f.ready();const pending=f.submit(tree);await f.submit(tree);assert.equal(f.requests.length,2);assert.equal(f.events.length,0,'must await server confirmation');f.reply({ok:true,json:async()=>({ok:true,id})});await pending;
 assert.equal(JSON.parse(f.requests[0].options.body).id,JSON.parse(f.requests[1].options.body).id);assert.equal(f.events.length,1);assert.equal(f.events[0][1],'generate_lead');assert.deepEqual(JSON.parse(JSON.stringify(f.events[0][2])),{event_category:'inquiry',page_location:'https://lawvetter.com',page_title:'LawVetter',page_referrer:''});f.tracking.trackInquiry(id);assert.equal(f.events.length,1);
 assert.equal(f.find(f.render(),'form'),undefined,'success keeps confirmation design');
});
test('duplicate protection survives module reload and works when storage is unavailable',async()=>{
 const storage=new Map(),first=await fixture({storage});first.tracking.trackInquiry(id);const reload=await fixture({storage});reload.tracking.trackInquiry(id);assert.equal(first.events.length,1);assert.equal(reload.events.length,0);
 const blocked=await fixture({blockedStorage:true});blocked.tracking.trackInquiry(id);blocked.tracking.trackInquiry(id);assert.equal(blocked.events.length,1);
});
test('privacy preferences and missing Analytics are respected without breaking submission',async()=>{
 const optedOut=await fixture({privacy:true});optedOut.tracking.trackInquiry(id);assert.equal(optedOut.events.length,0);
 const missing=await fixture();delete missing.window.gtag;missing.tracking.trackInquiry(id);assert.equal(missing.events.length,0);missing.window.gtag=(...args)=>missing.events.push(args);missing.tracking.trackInquiry(id);assert.equal(missing.events.length,1);
});

function textContent(node){if(node==null||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return [node.props?.children].flat(Infinity).map(textContent).join(' ');}
test('an unclaimed attorney contact form promises direct inbox delivery and submits the selected profile',async()=>{
 const f=await fixture({attorney:{bar:'FL:4444',name:'Selected Attorney',verified:false}}),tree=f.ready();
 const text=textContent(tree);assert.match(text,/DIRECT MESSAGE/);assert.match(text,/directly to this attorney’s private LawVetter inbox/);assert.doesNotMatch(text,/LawVetter receives it first|help you contact this attorney/);
 const pending=f.submit(tree);assert.equal(JSON.parse(f.requests[0].options.body).attorneyBar,'FL:4444');f.reply({ok:true,json:async()=>({ok:true,id})});await pending;assert.equal(f.find(f.render(),'ReferralConfirmation').props.attorney.bar,'FL:4444');
});
