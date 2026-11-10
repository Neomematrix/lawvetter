import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

// Component SSR smoke tests. Full Worker integration requires a Cloudflare runtime.
async function renderHero(){
 const source=await readFile(new URL('../app/LandingHero.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const context=vm.createContext({});
 const runtime=new vm.SyntheticModule(Object.keys(jsxRuntime),function(){for(const [key,value] of Object.entries(jsxRuntime))this.setExport(key,value);},{context});
 const component=new vm.SourceTextModule(code,{context});
 await component.link(async spec=>{if(spec==='./HeroSpotlightState')return new vm.SyntheticModule(['default'],function(){this.setExport('default',()=>null);},{context});assert.equal(spec,'react/jsx-runtime');return runtime;});
 await component.evaluate();
 return renderToStaticMarkup(createElement(component.namespace.default,{spotlight:createElement('aside',{'data-live-spotlight':'true'},'Current monthly leader'),search:createElement('form',{id:'attorney-search',role:'search'},createElement('button',{type:'submit'},'Search'))}));
}
test('LawVetter hero server-renders its real heading and embedded search and non-interactive slogan',async()=>{
 const html=await renderHero();
 assert.match(html,/<h1 id="lawvetter-hero-title">The Smarter Way to Find a Lawyer\.<\/h1>/);
 assert.match(html,/<div class="landing-hero-record-note">/);
 assert.doesNotMatch(html,/<a[^>]*class="landing-hero-record-note"/);
 assert.match(html,/<form id="attorney-search" role="search">/);
 assert.match(html,/<button type="submit">Search<\/button>/);
 assert.match(html,/aria-labelledby="lawvetter-hero-title"/);
 assert.doesNotMatch(html,/Your site is taking shape|Building your site|codex-preview/);
});
test('Hero replaces the stock image and verification pane with the live ranking slot',async()=>{
 const html=await renderHero();
 assert.match(html,/class="landing-hero-visual landing-ranking-visual"/);
 assert.match(html,/data-live-spotlight="true"/);
 assert.doesNotMatch(html,/lawvetter-attorney-welcome|lawvetter-review-check-title/);
 assert.match(html,/Verified Reviews from Real Clients/);
 assert.match(html,/The Smarter Way to Find a Lawyer\./);
});
