import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const catalogSource=fs.readFileSync('app/us-cities.ts','utf8');
const cities=JSON.parse(catalogSource.slice(catalogSource.indexOf('={')+1).trim().replace(/;$/,''));
test('city practice discovery combines assigned and source practices and respects owner edits',async()=>{
 const rows=[{bar_number:'1',city:'Atlanta',state:'GA',owner_edited:0,has_profile:0},{bar_number:'2',city:'Miami',state:'FL',owner_edited:1,has_profile:1},{bar_number:'3',city:'Atlanta',state:'TX',owner_edited:0,has_profile:0},{bar_number:'4',city:'Unknown',state:'XX',owner_edited:0,has_profile:0},{bar_number:'5',city:'Atlanta',state:'FL',owner_edited:0,has_profile:0},{bar_number:'6',city:'Chicago',state:'FL',owner_edited:0,has_profile:0},{bar_number:'7',city:'Chicago',state:'IL',owner_edited:0,has_profile:0},{bar_number:'8',city:'Doral',state:'FL',owner_edited:1,has_profile:1},{bar_number:'9',city:'New York',state:'NY',owner_edited:1,has_profile:1}];
 const stubs={'./public-read-cache':{publicReadCache:f=>f},react:{cache:f=>f},'./raw':{rawDb:()=>({prepare:sql=>{assert.match(sql,/active/);return {bind:value=>{assert.deepEqual(new Set(JSON.parse(value)),new Set(rows.map(row=>row.bar_number)));return {all:async()=>({results:rows})};}}}})},'./active-membership':{activeMembershipSQL:()=>"status='active'"},'./practice-categories':{practiceCatalog:async()=>({areas:[{id:'family-law'},{id:'aviation'},{id:'judge'},{id:'cannabis-law'}],bars:new Map([['aviation',new Set(['2'])],['judge',new Set(['2'])],['cannabis-law',new Set(['8','9'])]])})},'../app/practice-areas':{practiceSources:{'1':{areas:['family-law']},'2':{areas:['family-law']},'3':{areas:['family-law']},'4':{areas:['family-law']},'5':{areas:['family-law']},'6':{areas:['family-law']},'7':{areas:['family-law']}}},'../app/seo':{slugify:s=>s.toLowerCase()},'../app/us-states':{stateSearch:s=>['GA','FL','TX'].includes(s)?s:''}};
 stubs['../app/verified-city']={verifiedCity:(city,state)=>cities[state]?.includes(city)?{city,state,id:city.toLowerCase()+'-'+state.toLowerCase()}:null};
 const context=vm.createContext({}),code=ts.transpileModule(fs.readFileSync('db/local-directory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText,m=new vm.SourceTextModule(code,{context});
 await m.link(spec=>new vm.SyntheticModule(Object.keys(stubs[spec]),function(){for(const [k,v] of Object.entries(stubs[spec]))this.setExport(k,v)},{context}));await m.evaluate();const {markets}=await m.namespace.localDirectory();
 assert.deepEqual(JSON.parse(JSON.stringify(markets.map(m=>[m.id,m.practices]))),[['atlanta-ga',['family-law']],['miami-fl',['aviation']],['atlanta-tx',['family-law']],['chicago-il',['family-law']],['doral-fl',['cannabis-law']],['new york-ny',['cannabis-law']]]);
});
