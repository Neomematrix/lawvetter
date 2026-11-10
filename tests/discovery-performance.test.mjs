import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import * as react from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';

async function moduleFrom(file,dependencies={}){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);
 await mod.link(spec=>{const values=dependencies[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);});});
 await mod.evaluate();return mod.namespace;
}

test('Discovery server-renders current practice links, heading and dimensioned lazy icons without client initialization',async()=>{
 const icons=await moduleFrom('app/practice-icons.ts');
 const grid=await moduleFrom('app/PracticeAreaGrid.tsx',{'react/jsx-runtime':jsx,'./practice-icons':icons});
 const html=renderToStaticMarkup(createElement(grid.default,{areas:[{id:'family-law',name:'Family law',description:'Divorce and custody'},{id:'new-owner-category',name:'New category',description:'Newly published practice'}]}));
 assert.match(html,/<h1 id="discover-practice-title">Explore every practice area<\/h1>/);
 assert.match(html,/href="\/practice-areas\/family-law"/);
 assert.match(html,/href="\/practice-areas\/new-owner-category"/);
 assert.match(html,/Newly published practice/);
 const image=html.match(/<img[^>]+>/)?.[0];assert.ok(image);
 for(const attribute of ['width="42"','height="42"','loading="lazy"','decoding="async"','alt=""'])assert.ok(image.includes(attribute),attribute);
 assert.ok(fs.existsSync('public'+icons.practiceIcon('family-law')));
});

test('Homepage icons preserve original transparent artwork and leave vector sources unchanged',async()=>{
 const icons=await moduleFrom('app/practice-icons.ts');
 const home=await moduleFrom('app/home-practice-icons.ts',{'./practice-icons':icons});
 for(const id of ['family-law','criminal-defense','estate-planning','immigration','personal-injury']){
  const src=home.homePracticeIcon(id);assert.match(src,/\.png$/);
  const png=fs.readFileSync('public'+src);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png[25],6,'Original PNG must retain RGBA transparency');
 }
 for(const id of ['financial-law','judge','cannabis-law','tax','contracts']){
  assert.equal(home.homePracticeIcon(id),icons.practiceIcon(id));assert.match(home.homePracticeIcon(id),/\.svg$/);
 }
});

test('Monthly winners retain the featured card, rank bar and action regardless of portrait availability',async()=>{
 const empty={default:()=>null},home=await moduleFrom('app/MonthlySpotlight.tsx',{
  'react/jsx-runtime':jsx,'./us-states':{usStates:['GA','FL'],stateNames:['Georgia','Florida']},'./OwnershipSeal':empty,'./home-practice-icons':{homePracticeIcon:()=>undefined},
  './attorney-name':{attorneyDisplayName:name=>name},'./AttorneyReviewSummary':empty,
  './attorney-photo':{attorneyPhoto:(bar,key)=>key?'/portrait.webp':undefined},'./DiscoveryCarousels':{PopularAttorneys:()=>null},
  './practice-catalog':{practiceAreas:[],practiceCoverage:''},'./FirmLink':{FirmLink:()=>null},
  './Shortlist':{SaveAttorneyButton:()=>null,useShortlist:()=>({signedIn:true,attorneys:[],loading:false})},
  './seo':{attorneyPath:()=>'/lawyers/current-winner'},'./RankingMethod':{RankingMethod:()=>null},'./home-image':{homePortrait:()=>({src:'/portrait.webp'})}
 });
 for(const photo_key of [undefined,'portrait']){
  const winner={bar_number:'123456',name:'Example Winner',city:'Atlanta',rank:1,photo_key};
  const html=renderToStaticMarkup(createElement(home.default,{data:{monthly:[winner],weekly:[],weeklyFirms:[],monthLabel:'November 2026'},onOpen:()=>{},onView:()=>{},onPractice:()=>{}}));
  assert.match(html,/class="monthly-spotlight spotlight-featured/);assert.match(html,/class="spotlight-score"/);assert.match(html,/Most searched this month/);assert.match(html,/Explore attorney/);
  assert.equal(html.includes('class="spotlight-placeholder"'),!photo_key);
  assert.match(html,/href="\/\?view=charts&amp;period=monthly"/);
  assert.equal(renderToStaticMarkup(createElement(home.default,{data:{monthly:[]},onOpen:()=>{}})),'');
 }
});

 test('Missing homepage data preserves static content without inventing empty rankings',async()=>{
 const view=await moduleFrom('app/DirectoryContent.tsx',{'react/jsx-runtime':jsx,react});
 let data;const content=props=>{data=props.data;return createElement('p',null,'Homepage content remains available');};
 const html=renderToStaticMarkup(createElement(view.default,{view:'discover',initialView:'discover',initialComponent:content,data:null,onOpen:()=>{},onView:()=>{},onPractice:()=>{}}));
 assert.match(html,/Homepage content remains available/);assert.equal(data.unavailable,true);assert.doesNotMatch(html,/We couldn’t load this section/);
 });
