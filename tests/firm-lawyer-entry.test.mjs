import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
async function load(file,stubs={}){const context=vm.createContext({URL,URLSearchParams,Date});const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod=new vm.SourceTextModule(code,{context});await mod.link(spec=>{const exports=stubs[spec];assert.ok(exports,'Missing '+spec);return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});});await mod.evaluate();return mod.namespace;}
test('firm-specific add-lawyer links select admin or review flow and encode the firm safely',async()=>{
 const api=await load('app/firm-lawyer-entry.ts'),name='Grimes & Fertitta';
 for(const admin of [true,false]){const url=new URL(api.firmLawyerEntry(name,admin,'https://example.com/'),'https://lawvetter.test');assert.equal(url.pathname,admin?'/admin/records':'/add-listing');assert.equal(url.searchParams.get('firm'),name);assert.equal(url.searchParams.get('firmWebsite'),'https://example.com/');assert.equal(url.searchParams.get(admin?'add':'type'),'lawyer');}
 const defaults=api.firmLawyerDefaults('  '+name+'  ','javascript:alert(1)');assert.equal(defaults.firm,name);assert.equal(defaults.firmWebsite,'');assert.equal(api.firmLawyerDefaults(name,'https://name:password@example.com').firmWebsite,'');
});
test('public lawyer suggestion form shows the selected firm and prefills both firm fields',async()=>{
 const child=()=>null,stubs={react:React,'react/jsx-runtime':jsx,'../phone-format':{formatPhoneEvent:()=>{}},'../firm-submission-requirements':{requireFirmSubmission:()=>{}},'../attorney-location':{requireAttorneyLocation:()=>{}}};for(const spec of ['../LanguagePicker','../admin/records/FirmImageUpload','../PhotoFrameEditor','../DirectoryCaptcha','../CityAutocomplete','./ListingAddressFields','./ListingPracticePicker'])stubs[spec]={default:child};
 const {default:Form}=await load('app/add-listing/AddListing.tsx',stubs),html=renderToStaticMarkup(React.createElement(Form,{initialFirm:'Grimes and Fertitta',initialFirmWebsite:'https://www.grimesfertitta.com/'}));assert.match(html,/Adding a lawyer to/);assert.match(html,/name="firmName"[^>]*value="Grimes and Fertitta"/);assert.match(html,/name="firmWebsite"[^>]*value="https:\/\/www.grimesfertitta.com\/"/);
});
