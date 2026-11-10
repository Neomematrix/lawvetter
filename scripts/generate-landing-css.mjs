import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import {transform} from 'esbuild';
import {gzipSync} from 'node:zlib';

// Conservative, route-local critical CSS. The complete original stylesheet is
// still loaded asynchronously, including every other route and interaction.
// Follow relative component imports, including lazy views used by navigation.
const visited=new Set(),tokens=new Set();
function visit(file){
 if(visited.has(file)||!fs.existsSync(file))return;
 visited.add(file);
 const source=fs.readFileSync(file,'utf8');
 for(const token of source.match(/[a-zA-Z_][\w-]*/g)||[])tokens.add(token);
 for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){
  const base=path.resolve(path.dirname(file),match[1]);
  for(const ext of ['.tsx','.ts'])if(fs.existsSync(base+ext)){visit(base+ext);break;}
 }
}
for(const entry of ['HomeClient','LegalFooter','Shortlist','InquiryMetrics','ClientErrorBoundary'])visit(path.resolve('app/'+entry+'.tsx'));
const files=['fonts','globals','editorial-dark','chart-halo','charts-performance'];
const source=files.map(name=>fs.readFileSync('app/'+name+'.css','utf8')).join('\n');
const root=postcss.parse(source);
root.walkComments(comment=>comment.remove());
root.walkRules(rule=>{
 if(rule.parent?.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;
 const selectors=postcss.list.comma(rule.selector).filter(selector=>{
  // Keep alternatives and relational selectors intact. Negative classes do
  // not require a corresponding positive class in the rendered components.
  if(/:(?:is|where|has)\(/.test(selector))return true;
  const positive=selector.replace(/:not\([^)]*\)/g,'');
  return [...positive.matchAll(/\.([a-zA-Z_][\w-]*)/g)].every(match=>tokens.has(match[1]));
 });
 if(selectors.length)rule.selector=selectors.join(',');else rule.remove();
});
root.walkAtRules(rule=>{if(rule.nodes&&!rule.nodes.length)rule.remove();});
const {code}=await transform(root.toString(),{loader:'css',minify:true,target:'chrome100'});
if(/<\/style/i.test(code))throw Error('Unsafe critical CSS');
fs.writeFileSync('worker/landing-critical.json',JSON.stringify({css:code})+'\n');
console.log(`Landing CSS: ${gzipSync(code).length} gzip bytes; full original ${gzipSync(source).length}; ${visited.size} source modules`);
