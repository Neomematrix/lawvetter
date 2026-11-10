import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
test('Saved sitemap survives a new isolate, isolates file keys, and rejects invalid files without D1',async()=>{
 const entries=new Map(),pending=[];let generations=0,origins=0;
 const store={async match(req){return entries.get(req.url)?.clone();},async put(req,res){entries.set(req.url,res);}};
 function load(){
  const snapshotExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('db/public-snapshot.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:snapshotExports,Request,Response,console});
  const deps={'cloudflare:workers':{env:{}},'./sitemap-refresh-lease':{withSitemapRefreshLease:(_bucket,load)=>load()},'./public-snapshot':snapshotExports,'./public-discovery-store':{discoverySnapshotStore:async namespace=>{assert.equal(namespace,'sitemaps-v1');return store;},keepDiscoveryRefresh:p=>pending.push(p)},'./sitemaps':{sitemapIndex:async()=>{generations++;return '<index/>';},sitemapPage:async file=>{generations++;return '<urlset>'+file+'</urlset>';}},'./site-settings':{siteOrigin:async()=>{origins++;return 'https://www.lawvetter.com';}}};
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('db/sitemap-snapshot.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:k=>deps[k],Request,Response,console});return exports.savedSitemap;
 }
 const read=load();assert.deepEqual(await Promise.all([read('index.xml'),read('index.xml')]),['<index/>','<index/>']);await Promise.all(pending);assert.equal(generations,1);
 assert.equal(await load()('index.xml'),'<index/>');assert.equal(origins,1,'Saved sitemap must not require a settings database query');
 assert.equal(await read('attorneys-1.xml'),'<urlset>attorneys-1.xml</urlset>');await Promise.all(pending);
 assert.equal(await read('../../private'),null);assert.equal(generations,2);
});
