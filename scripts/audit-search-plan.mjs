// Local-only synthetic workload. Never connects to production or another site.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const module=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('app/api/attorneys/search.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
await module.link(()=>{});await module.evaluate();
const insert=sql.prepare("INSERT INTO attorneys(bar_number,source_id,name,company,city,state,status,source_url,imported_at) VALUES(?,?,?,?,?,'GA','Member in Good Standing','','')");
sql.exec('BEGIN');for(let i=0;i<100000;i++)insert.run(String(i),String(i),'Person '+i,'Firm '+i,'Atlanta');insert.run('target','target','Jane Example','Example Legal','Atlanta');sql.exec('COMMIT');
const search=module.namespace.attorneyNameSearch('Jane Example','','prefix',false);
const modules=new Map();async function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText,{identifier:file});modules.set(file,m);return m;}
const indexed=await load('db/search-index.ts');await indexed.link((spec,parent)=>load(path.resolve(path.dirname(parent.identifier),spec)+'.ts'));await indexed.evaluate();const candidate=indexed.namespace.nameIndexFilter('Jane Example',false);
const queries=[['indexed name count','SELECT count(*) FROM attorneys WHERE '+candidate.where+' AND ('+search.where+')',[...candidate.args,...search.args]],['name count','SELECT count(*) FROM attorneys WHERE '+search.where,search.args],['practice candidate count','SELECT count(*) FROM attorneys WHERE bar_number IN (SELECT value FROM json_each(?))',[JSON.stringify(['target','1','2'])]]];
for(const [label,query,args] of queries){const plan=sql.prepare('EXPLAIN QUERY PLAN '+query).all(...args).map(row=>row.detail);const statement=sql.prepare(query);const start=performance.now();for(let i=0;i<10;i++)statement.get(...args);console.log(JSON.stringify({label,rows:100001,iterations:10,milliseconds:Math.round((performance.now()-start)*100)/100,plan}));}
sql.close();
