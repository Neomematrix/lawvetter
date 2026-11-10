import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

test('Attorney account entry renders the dashboard immediately for a verified session and never flashes registration while checking',async()=>{
 const code=ts.transpileModule(fs.readFileSync('app/account/AttorneyLogin.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new vm.SourceTextModule(code);
 await mod.link(spec=>{const values=spec==='react'?React:spec==='react/jsx-runtime'?jsx:spec.includes('profile-request')?{profileRequest:async()=>({profiles:[],claims:[],submissions:[]})}:spec.includes('AttorneyAccount')?{default:()=>React.createElement('section',null,'Attorney dashboard workspace')}:{default:()=>null};return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);});});await mod.evaluate();
 const render=props=>renderToStaticMarkup(React.createElement(mod.namespace.default,props));
 let html=render({});assert.match(html,/Loading your workspace/);assert.doesNotMatch(html,/Your Attorney Account|Create Account|No Attorney Account Found/);
 html=render({initialSession:'attorney'});assert.match(html,/Attorney dashboard workspace/);assert.doesNotMatch(html,/Loading your workspace|Your Attorney Account|Create Account/);
 html=render({initialSession:'guest'});assert.match(html,/Your Attorney Account/);assert.match(html,/Create Account/);assert.doesNotMatch(html,/Attorney dashboard workspace/);
});
