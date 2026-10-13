import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
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
 await component.link(spec=>{assert.equal(spec,'react/jsx-runtime');return runtime;});
 await component.evaluate();
 return renderToStaticMarkup(createElement(component.namespace.default));
}
test('LawVetter hero server-renders its real heading and working entry links',async()=>{
 const html=await renderHero();
 assert.match(html,/<h1 id="lawvetter-hero-title">Real reviews from real clients of lawyers\.<\/h1>/);
 assert.match(html,/href="\/client-reviews"/);
 assert.match(html,/href="#attorney-search"/);
 assert.match(html,/aria-labelledby="lawvetter-hero-title"/);
 assert.doesNotMatch(html,/Your site is taking shape|Building your site|codex-preview/);
});
test('Rendered hero references bundled images and explains review verification',async()=>{
 const html=await renderHero();
 const images=[...html.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/g)];
 assert.ok(images.length>0);
 for(const match of images){assert.match(match[1],/^\//);await access(new URL('../public'+match[1],import.meta.url));assert.match(match[0],/alt="[^"]+"/);}
 assert.match(html,/We check the client relationship behind every review\./);
 assert.match(html,/Case number checked/);
 assert.match(html,/Client connection reviewed/);
});
