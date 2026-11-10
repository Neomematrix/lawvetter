import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';

const manifest=JSON.parse(await readFile('dist/client/.vite/manifest.json','utf8'));
const pages={
 home:['app/HomeClient.tsx','app/DiscoveryHome.tsx','app/HeroMonthlySpotlight.tsx'],
 charts:['app/HomeClient.tsx','app/Charts.tsx'],
 discover:['app/discover/DiscoverClient.tsx'],
};
function dependencies(entries){
 const visited=new Set();
 function walk(key){if(visited.has(key))return;visited.add(key);assert.ok(manifest[key],`Missing built module: ${key}`);for(const dependency of manifest[key].imports||[])walk(dependency);}
 entries.forEach(walk);return visited;
}
for(const [page,entries]of Object.entries(pages)){
 const modules=dependencies(entries);
 // Charts now owns the monthly spotlight and intentionally reuses its optimized
 // portrait metadata. Discover still must not import those image helpers.
 if(page==='discover')for(const key of modules)assert.ok(!/home-image/.test(key),`${page} eagerly imports a homepage image helper: ${key}`);
 const forbidden=Object.values(pages).flat().filter(entry=>!entries.includes(entry)&&entry!=='app/HomeClient.tsx');
 for(const entry of [...forbidden,'app/ShortlistPage.tsx'])assert.ok(!modules.has(entry),`${page} eagerly imports ${entry}`);
 const files=new Set([...modules].flatMap(key=>[manifest[key].file,...(manifest[key].css||[])]));
 if(page!=='charts')assert.ok(!files.has(manifest['app/Charts.tsx'].css?.[0]),`${page} eagerly loads chart-only CSS`);
 let bytes=0;for(const file of files)bytes+=gzipSync(await readFile('dist/client/'+file)).length;
 console.log(`${page}: ${modules.size} static modules, ${bytes} gzip bytes; page boundaries verified`);
}
