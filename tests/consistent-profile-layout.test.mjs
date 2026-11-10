import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
const empty={__esModule:true,default:()=>null};
const employment={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/employment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:employment});
const stubs={
 './employment':employment,
 'react':{useEffect:()=>{},useRef:()=>({current:null}),useState:value=>[value,()=>{}]},'react/jsx-runtime':jsx,
 './record-directory-visit':{recordDirectoryVisit:()=>{}},'./membership-status':{membershipStatus:value=>value},
 './practice-icons':{practiceIcon:()=>null},'./practice-category':{splitPracticeAreas:value=>value?value.split(','):[],practiceCategoryId:value=>value.toLowerCase()},
 './practice-catalog':{practiceAreas:[]},'./attorney-photo':{attorneyPhoto:()=>undefined},'./profile-request':{profileRequest:async()=>({})},
 './Shortlist':{SaveAttorneyButton:()=>null},'./FirmLink':{FirmLink:({name})=>React.createElement('a',null,name)},'./seo':{attorneyPath:()=>'/attorney',absoluteUrl:x=>x}
};
const exported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/AttorneyProfile.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exported,require:spec=>stubs[spec]||empty});
const base={bar_number:'123456',name:'Example Attorney',state:'GA',city:'Atlanta',status:'Member in Good Standing',address:'100 Main Street',phone:'404-555-0100',email:'lawyer@example.test'};
function render(fields={}){const dom=new JSDOM(renderToStaticMarkup(exported.default({attorney:{...base,...fields}})));return dom.window.document;}
test('Solo and firm-linked profiles share office locations without repeated contact details',()=>{
 for(const company of ['', 'Example Firm']){
  const doc=render({company,practice_areas:'Family Law'}),body=doc.querySelector('.profile-body');
  assert.equal(body.className,'profile-body');assert.deepEqual([...body.children].map(el=>el.className),['credentials','profile-contact profile-office-location','profile-reviews-panel']);
  const office=body.querySelector('.profile-contact');
  assert.equal(office.querySelector('h3').textContent,'Office location');assert.match(office.textContent,/100 Main Street/);
  assert.equal(office.querySelector('a[href^="tel:"],a[href^="mailto:"]'),null);
  const directions=new URL(office.querySelector('a[href^="https://www.google.com/maps/dir/"]').href);
  assert.equal(directions.searchParams.get('destination'),'100 Main Street, Atlanta, GA');
  const apple=new URL(office.querySelector('a[href^="https://maps.apple.com/"]').href);
  assert.equal(apple.searchParams.get('daddr'),'100 Main Street, Atlanta, GA');
  const chooser=office.querySelector('details.office-directions');assert.equal(chooser.hasAttribute('open'),false);
  assert.equal(chooser.querySelector('summary').textContent,'Get directions');assert.equal(chooser.querySelectorAll('a').length,2);
  assert.ok(doc.querySelector('.profile-action-tiles a[href="mailto:lawyer@example.test"]'));
  assert.ok(doc.querySelector('.profile-action-tiles a[href="tel:4045550100"]'));
 }
});
test('Missing details preserve panels with honest empty states; judges keep contact and review restrictions',()=>{
 const missing=render({company:'Example Firm',address:'',phone:'',email:'',practice_areas:''});
 assert.match(missing.querySelector('.profile-contact').textContent,/not published/);assert.equal(missing.querySelector('.office-directions'),null);assert.match(missing.querySelector('.profile-practice').textContent,/Not listed/);
 const judge=render({practice_areas:'Judge'});assert.equal(judge.querySelector('.profile-contact'),null);assert.equal(judge.querySelector('.profile-reviews-panel'),null);assert.ok(judge.querySelector('.credentials'));
});

 test('All employment labels render with contact links, and employers never link to firm pages',()=>{
 for(const type of ['Law Firm Attorney','In House Counsel','Government Attorney']){
 const doc=render({employment_type:type,company:type==='Law Firm Attorney'?'Example Legal':'',employer_name:'Example Organization',employer_website:'https://employer.example/',biography_website:'https://attorney.example/'});
 assert.equal(doc.querySelector('.role').textContent,type==='Law Firm Attorney'?'Example Legal':type+' at Example Organization');assert.ok(doc.querySelector('a[href^="tel:"]'));assert.ok(doc.querySelector('a[href^="mailto:"]'));assert.ok(doc.querySelector('a[href="https://attorney.example/"]'));
 if(type!=='Law Firm Attorney'){assert.equal(doc.querySelector('.role a'),null);assert.ok(doc.querySelector('a[href="https://employer.example/"]'));}
 }
 });
