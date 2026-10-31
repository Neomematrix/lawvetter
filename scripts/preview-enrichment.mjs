// Local-only preview of the real component with conspicuously synthetic data.
// No auth bypass is added to the application. No database or remote sources.
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'.next/enrichment-preview');await mkdir(out,{recursive:true});
const entry=path.join(out,'entry.tsx');
await writeFile(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import Dashboard from '../../app/admin/enrichment/EnrichmentDashboard';createRoot(document.getElementById('root')!).render(<Dashboard/>);`);
await build({entryPoints:[entry],bundle:true,outfile:path.join(out,'app.js'),format:'esm',jsx:'automatic',plugins:[{name:'local-next-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'next-link',namespace:'preview'}));b.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,resolveDir:root,loader:'jsx'}));}}]});
const evidence={state:'FL',entity:'attorney',entity_id:'FL:900001',name:'Fixture Attorney 01',status:'pending',source_url:'https://example.test/synthetic-evidence',retrieved_at:new Date().toISOString(),excerpt:'Synthetic source fixture: no real attorney facts.',verified:1,rights:'',note:''};
const rows=[{...evidence,id:'fixture-school',kind:'text',field:'law_school',original:'',proposed:'Fixture Law School',explanation:'Demonstration of an identity-matched missing field. This preview contains synthetic data only.'},{...evidence,id:'fixture-date',kind:'text',field:'admit_date',original:'',proposed:'2014-10-20',explanation:'Demonstration of an admission date extracted from labeled fixture markup.'},{...evidence,id:'fixture-photo',kind:'photo',field:'photo_key',original:'synthetic-before',proposed:'synthetic-after',rights:'Locally generated demonstration graphic.',explanation:'Synthetic image preview, not a real attorney. Original and replacement are reviewed side by side.'}];
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:#0d171d;font-family:Arial,sans-serif}*{box-sizing:border-box}.fixture-banner{background:#f1d994;color:#352b14;padding:10px;text-align:center;font-size:12px}</style></head><body><div class="fixture-banner">LOCAL SYNTHETIC FIXTURE PREVIEW — NO LIVE DATA OR PUBLICATION</div><div id="root"></div><script type="module" src="/app.js"></script></body></html>`;
const stats=()=>({scanned:25,missing:75,verified:2,photos:1,banners:0,pending:rows.filter(p=>p.status==='pending').length,approved:rows.filter(p=>p.status==='approved').length,rejected:rows.filter(p=>p.status==='rejected').length});
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/admin/enrichment'){
  if(req.method==='POST'){let body='';for await(const c of req)body+=c;const data=JSON.parse(body);for(const p of rows)if(data.ids?.includes(p.id))p.status=data.action;}
  const filtered=rows.filter(p=>['entity','kind','state','status'].every(k=>!url.searchParams.get(k)||url.searchParams.get(k)===p[k]));
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({rows:filtered,stats:stats(),scans:[{id:'fixture-scan',status:'completed',created_at:'2026-10-31T04:00:00Z',scanned:25,errors:0}],errors:[],nextScan:'2026-11-01T04:00:00Z'}));return;
 }
 if(url.pathname==='/api/enrichment-image'){res.setHeader('Content-Type','image/svg+xml');res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#dbe6e3"/><circle cx="200" cy="175" r="65" fill="#74928c"/><path d="M80 410 Q80 280 200 280 Q320 280 320 410" fill="#74928c"/><text x="200" y="470" text-anchor="middle" font-family="Arial" font-size="16">SYNTHETIC ${url.searchParams.get('version')?.toUpperCase()}</text></svg>`);return;}
 try{const file=url.pathname==='/app.js'?'app.js':url.pathname==='/app.css'?'app.css':null;if(file){res.setHeader('Content-Type',file.endsWith('js')?'text/javascript':'text/css');res.end(await readFile(path.join(out,file)));}else{res.setHeader('Content-Type','text/html');res.end(html);}}catch{res.statusCode=404;res.end();}
}).listen(4177,'127.0.0.1',()=>console.log('Synthetic dashboard preview: http://127.0.0.1:4177'));
