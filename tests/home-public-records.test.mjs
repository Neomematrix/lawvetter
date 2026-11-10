import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
test('Homepage cards receive the same public identifiers as review summaries',async()=>{
 const context=vm.createContext({console}),raw={weekly:[{bar_number:'238455'}]},published={weekly:[{bar_number:'LV5db5b176d31c27fb03c8b2607f892161'}]};
 const stubs={'./HeroMonthlySpotlight':{default:()=>null},
 './read-json':{readDeadline:promise=>promise},'../db/public-discovery':{publicDiscoveryData:async()=>published},
 '../db/public-records':{publicRecords:async value=>{assert.equal(value,raw);return published;}},
 '../db/site-settings':{siteOrigin:()=>'',publicSettings:async()=>({origin:''})},
 './HomeClient':{default:()=>null},
 './DiscoveryHome':{DiscoveryHome:()=>null},'./Charts':{Charts:()=>null},'./ShortlistPage':{ShortlistPage:()=>null},
 './api/attorneys/charts':{discoveryData:async()=>raw},
 '../db/raw':{rawDb:()=>({})},
 './seo':{SITE_DESCRIPTION:'',SITE_ORIGIN:''},
 'react/jsx-runtime':{Fragment:'fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
 };
 const code=ts.transpileModule(fs.readFileSync('app/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code,{context});
 await mod.link(name=>{const values=stubs[name];assert.ok(values,name);return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});
 await mod.evaluate();
 const result=await mod.namespace.default({searchParams:Promise.resolve({})});
 const home=result.props.children[2];
 assert.equal(await home.props.initialHome,published);
 assert.equal(result.props.children[0].props.href,'/fonts/lato.7a7ce1a34f3e.woff2');
 assert.equal(result.props.children[1].props.href,'/fonts/lato.bd9a6192274f.woff2');
 const charts=await mod.namespace.default({searchParams:Promise.resolve({view:'charts'})});
 assert.equal(charts.props.children[0].props.href,'/fonts/lato.7a7ce1a34f3e.woff2');
});
