import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
async function render(request){
 const context=vm.createContext({}),cache=new Map();
 async function load(file){if(cache.has(file))return cache.get(file);let module;
 if(file==='react'||file==='react/jsx-runtime'){const values=file==='react'?React:jsxRuntime;module=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});cache.set(file,module);await module.link(()=>{});return module;}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 module=new vm.SourceTextModule(code,{context,identifier:file});cache.set(file,module);await module.link(spec=>{if(spec.startsWith('react'))return load(spec);const base=path.resolve(path.dirname(file),spec);return load(fs.existsSync(base+'.tsx')?base+'.tsx':base+'.ts');});return module;
 }
 const component=await load(path.resolve('app/client-reviews/ReviewEditor.tsx'));await component.evaluate();return renderToStaticMarkup(React.createElement(component.namespace.default,{request,onSaved:async()=>{}}));
}
const request={id:'private-id',bar_number:'100001',legal_name:'Test Client',published_at:'2026-10-12T15:00:00Z',review_body:'A published review.',public_mode:'anonymous',review_status:'',review_draft:'',review_decision_note:'',rating_use_again:5,rating_cared_for:4,rating_rights:3,rating_outcome:2};
test('Published reviews render a saved summary and explicit edit button, without an open editor',async()=>{const html=await render(request);assert.match(html,/Review published\./);assert.match(html,/Edit my review/);assert.match(html,/View public review/);assert.match(html,/A published review\./);assert.doesNotMatch(html,/<textarea|<form|Remove my review/);});
test('Pending review submissions render a waiting confirmation, without an open editor or premature publication claim',async()=>{const html=await render({...request,review_status:'pending'});assert.match(html,/Review submitted for approval/);assert.match(html,/until the administrator approves/);assert.doesNotMatch(html,/<textarea|<form|Review published\./);});

test('Previously submitted first reviews can be published by their verified client without reopening the editor',async()=>{const html=await render({...request,published_at:null,review_status:'pending',review_draft:JSON.stringify({body:'Saved review text.',mode:'anonymous'})});assert.match(html,/Publish submitted review/);assert.doesNotMatch(html,/<textarea|awaiting approval/);});
