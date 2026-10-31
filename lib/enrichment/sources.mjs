// Conservative, deterministic extraction. Unrecognized markup produces a review task,
// never a model-generated fact. Additional states implement this adapter contract.
export const adapterVersion = 'fl-1';
export const fields = Object.freeze({admit_date:'Admission date',law_school:'Law school',county:'County',status:'Membership status',company:'Firm affiliation',address:'Address',city:'City',zip:'ZIP',website:'Website',practice_areas:'Practice areas'});
const clean = s => s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();
const normalized = s => clean(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function officialUrl(attorney) {
  const url = new URL(attorney.source_url);
  const license = String(attorney.license_number || attorney.bar_number.replace(/^FL:/,''));
  if(attorney.state !== 'FL' || !/^\d{1,20}$/.test(license) || url.protocol !== 'https:' || !['www.floridabar.org','floridabar.org'].includes(url.hostname) || url.port || url.username || url.password || !['/directories/find-mbr/profile/','/about/section/profile/'].includes(url.pathname) || url.searchParams.getAll('num').length!==1 || url.searchParams.get('num')!==license) throw Error('Official source or state/license mismatch');
  return url;
}
export function extractFlorida(html, attorney) {
  officialUrl(attorney);
  if(/captcha|access denied|verify you are human|just a moment/i.test(html)) throw Error('Source access challenge; manual review required');
  const names=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(x=>clean(x[1]));
  const text=clean(html),license=String(attorney.license_number || attorney.bar_number.replace(/^FL:/,''));
  const barMatches=[...text.matchAll(/(?:Bar\s*(?:Number|No\.?|#)\s*:?\s*)(\d+)/gi)].map(x=>x[1]);
  if(names.length!==1 || normalized(names[0])!==normalized(attorney.name) || barMatches.length!==1 || barMatches[0]!==license) throw Error('Conflicting or ambiguous attorney identity');
  const pairs = new Map();
  // Florida profile labels use dt/dd; table label/value cells are also supported.
  for(const pattern of [/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi,/<tr\b[^>]*>\s*<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi]) {
    for(const [,label,value] of html.matchAll(pattern)) { const key=normalized(label),v=clean(value); if(pairs.has(key)&&pairs.get(key)!==v)throw Error('Conflicting source field'); pairs.set(key,v); }
  }
  const aliases={admit_date:['admitted','admission date','admitted to the florida bar'],law_school:['law school'],county:['county'],status:['membership status','member status'],company:['firm','firm name'],address:['address','mailing address'],city:['city'],zip:['zip','zip code'],website:['website','firm website'],practice_areas:['practice areas']};
  const values={};
  for(const [field,labels] of Object.entries(aliases)) {
    const found=[...new Set(labels.map(l=>pairs.get(l)).filter(Boolean))];
    if(found.length>1)throw Error('Conflicting source field');
    let value=found[0]; if(!value || /^(not (?:provided|listed)|n\/a|none|unknown|-)$/i.test(value))continue;
    if(value.length>2000)continue;
    if(field==='admit_date') {const m=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)continue;value=`${m[3]}-${m[1]}-${m[2]}`;if(new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)continue;}
    if(field==='website') {try {const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)continue;value=u.href;}catch{continue;}}
    values[field]={value,excerpt:labels.map(l=>pairs.get(l)).find(Boolean)};
  }
  if(!Object.keys(values).length)throw Error('Unsupported source layout or no extractable fields; manual review required');
  return {name:names[0],state:'FL',license,values};
}
export async function boundedText(response, max=750000) {
  const reader=response.body?.getReader(); if(!reader)throw Error('Empty source response');
  const chunks=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Source exceeds size limit');chunks.push(value);}}
  finally {await reader.cancel();}
  const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return new TextDecoder().decode(bytes);
}
export function robotsAllowed(text,path) {
  // Fail closed on any applicable disallow; intentionally conservative.
  let applicable=false;
  for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim();const match=line.match(/^([^:]+):\s*(.*)$/);if(!match)continue;const [,key,value]=match;
    if(key.toLowerCase()==='user-agent')applicable=value==='*'||/lawvetter/i.test(value);
    if(applicable&&key.toLowerCase()==='disallow'&&value&&path.startsWith(value.replace(/\*.*$/,'')))return false;
  }return true;
}
export async function research(attorney, fetcher=fetch) {
  const url=officialUrl(attorney);
  const get=async target=>{
    const response=await fetcher(target,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'LawVetterEnrichment/1.0 (owner-authorized professional directory research)','Accept':'text/html,text/plain'}});
    if(response.status===429 || response.status>=500)throw Error('Retryable source response '+response.status);
    if(!response.ok)throw Error('Source unavailable '+response.status+'; no bypass attempted');
    return response;
  };
  const robots=await get(new URL('/robots.txt',url));
  if(!robotsAllowed(await boundedText(robots,100000),url.pathname))throw Error('Source robots policy disallows research');
  const response=await get(url);
  if(!(response.headers.get('content-type')||'').includes('text/html'))throw Error('Unexpected source format');
  const html=await boundedText(response),result=extractFlorida(html,attorney);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html));
  return {...result,url:url.href,retrievedAt:new Date().toISOString(),hash:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')};
}
export const adapters = Object.freeze({FL:research});
