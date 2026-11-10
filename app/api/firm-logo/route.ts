import {firmBannerError} from '../../firm-banner';
import {env} from 'cloudflare:workers';
import {adminIdentity} from '../../../db/admin-auth';
import {rawDb} from '../../../db/raw';
import {firmKey,firmColumn} from '../attorneys/firm';
import {websitesByFirm} from '../../firm-websites';
import {verifiedFirmLogos} from '../../verified-firm-logos';

const cacheHeaders={'Cache-Control':'public, max-age=300, s-maxage=300'};
const uploadKey=(key:string)=>'firm-logos/'+encodeURIComponent(key)+'/banner';
const browserHeaders={
 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36',
 'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
 'Accept-Language':'en-US,en;q=0.9',
 'Sec-Fetch-Dest':'document',
 'Sec-Fetch-Mode':'navigate',
 'Sec-Fetch-Site':'none',
 'Upgrade-Insecure-Requests':'1'
};
type LogoCandidate={url:string;score:number};

function attribute(tag:string,name:string){
 const match=tag.match(new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));
 return match?.[1]||match?.[2]||match?.[3]||'';
}

function imageUrl(value:string,base:string){
 if(!value||value.startsWith('data:'))return '';
 try{const url=new URL(value.replaceAll('&amp;','&'),base);return url.protocol==='http:'||url.protocol==='https:'?url.href:'';}catch{return '';}
}

function candidateScore(description:string,url:string,tag=''){
 const text=(description+' '+url).toLowerCase();
 let score=0;
 if(/logo/.test(text))score+=12;
 if(/wordmark|horizontal|full[-_ ]?logo|primary[-_ ]?logo|header[-_ ]?logo|site[-_ ]?logo/.test(text))score+=8;
 if(/brand/.test(text))score+=5;
 if(/blue|dark|black|color(?:ed)?/.test(text))score+=4;
 if(/white|light|reverse|negative/.test(text))score-=6;
 if(/favicon|apple-touch|icon-|[-_]icon|logo[-_ ]?mark|symbol|mobile[-_ ]?logo/.test(text))score-=14;
 if(/footer/.test(text))score-=5;
 if(/\.svg(?:\?|$)/i.test(url))score+=2;
 const width=Number(attribute(tag,'width')),height=Number(attribute(tag,'height'));
 if(width&&height&&width/height>=2)score+=6;
 return score;
}

function logoCandidates(html:string,base:string){
 const candidates:LogoCandidate[]=[];
 const imagePattern=/<img\b[^>]*>/gi;
 for(const match of html.matchAll(imagePattern)){
  const tag=match[0],index=match.index||0;
  const context=html.slice(Math.max(0,index-260),Math.min(html.length,index+tag.length+80));
  const raw=attribute(tag,'data-src')||attribute(tag,'data-lazy-src')||attribute(tag,'data-original')||attribute(tag,'src');
  const url=imageUrl(raw,base);if(!url)continue;
  const description=[context,attribute(tag,'class'),attribute(tag,'id'),attribute(tag,'alt'),attribute(tag,'itemprop')].join(' ');
  const score=candidateScore(description,url,tag);
  if(score>=10)candidates.push({url,score});
 }
 for(const match of html.matchAll(/"logo"\s*:\s*(?:\{[^{}]{0,600}?"(?:url|contentUrl)"\s*:\s*)?"([^"\\]+)"/gi)){
  const url=imageUrl(match[1],base);if(url)candidates.push({url,score:16+candidateScore('structured official logo',url)});
 }
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
  const property=[attribute(tag,'property'),attribute(tag,'name'),attribute(tag,'itemprop')].join(' ').toLowerCase();
  if(!/(^|\s)(og:logo|logo)(\s|$)/.test(property))continue;
  const url=imageUrl(attribute(tag,'content'),base);if(url)candidates.push({url,score:18+candidateScore('official logo',url)});
 }
 return candidates;
}

function aboutPage(html:string,base:string){
 for(const tag of html.match(/<a\b[^>]*>/gi)||[]){
  const href=attribute(tag,'href');
  if(!/(?:^|\/)(?:about|about-us|our-firm|who-we-are)(?:\/|$|\?)/i.test(href))continue;
  try{const url=new URL(href,base),origin=new URL(base).origin;if(url.origin===origin)return url.href;}catch{}
 }
 return '';
}

async function readPage(url:string){
 const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(6500),headers:browserHeaders});
 if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return null;
 return {html:(await response.text()).slice(0,900000),url:response.url||url};
}

export async function GET(request:Request){
 const params=new URL(request.url).searchParams,key=params.get('key')||'';
 const responseCacheHeaders=params.has('preview')?{'Cache-Control':'no-store'}:cacheHeaders;
 if(!key||key.length>500)return new Response('Invalid firm.',{status:400});
 try{const setting=await rawDb().prepare('SELECT banner_key FROM firm_settings WHERE key=?').bind(key).first<{banner_key:string}>();const file=setting?.banner_key&&await env.PROFILE_PHOTOS.get(setting.banner_key);if(file)return new Response(file.body,{headers:{'Cache-Control':'no-store','Content-Type':file.httpMetadata?.contentType||'image/png','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Logo unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});}
 const override=verifiedFirmLogos[key];
 if(override)return new Response(null,{status:302,headers:{...responseCacheHeaders,Location:override}});
 const website=websitesByFirm[key];
 if(!website)return new Response('Firm website not found.',{status:404,headers:{'Cache-Control':'no-store'}});
 try{
  const home=await readPage(website);
  if(home){
   const candidates=logoCandidates(home.html,home.url);
   const about=aboutPage(home.html,home.url);
   if(about){const page=await readPage(about);if(page)candidates.push(...logoCandidates(page.html,page.url));}
   const logo=candidates.sort((a,b)=>b.score-a.score)[0]?.url;
   if(logo)return new Response(null,{status:302,headers:{...responseCacheHeaders,Location:logo}});
  }
 }catch{}
 // Accuracy is more important than coverage: never substitute a favicon for a full firm logo.
 return new Response('Verified full logo not found.',{status:404,headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
 if(!await adminIdentity(request))return Response.json({error:'Sign in as administrator.'},{status:401});
 try{
  const reader=request.body?.getReader();if(!reader)return Response.json({error:'Choose a firm image.'},{status:400});
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4*1024*1024){await reader.cancel();return Response.json({error:'Upload a JPEG or PNG smaller than 3 MB.'},{status:413});}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
  const name=String(form.get('firm')||'').trim(),photo=form.get('photo'),key=firmKey(name);
  if(!key||name.length>200||!(photo instanceof File)||photo.size<24||photo.size>3*1024*1024)return Response.json({error:'Choose a law firm and a JPEG or PNG smaller than 3 MB.'},{status:400});
  if(!await rawDb().prepare('SELECT key FROM firm_settings WHERE key=? UNION SELECT '+firmColumn()+' AS key FROM attorneys WHERE '+firmColumn()+'=? LIMIT 1').bind(key,key).first())return Response.json({error:'Save an attorney with this firm first.'},{status:404});
  const buffer=await photo.arrayBuffer(),head=new Uint8Array(buffer),png=[137,80,78,71,13,10,26,10].every((n,i)=>head[i]===n),jpeg=head[0]===255&&head[1]===216&&head[2]===255;
  if(!png&&!jpeg)return Response.json({error:'Only JPEG and PNG images are accepted.'},{status:400});
  const bannerError=firmBannerError(head);if(bannerError)return Response.json({error:bannerError},{status:400});
  const storedKey=uploadKey(key)+'/'+crypto.randomUUID();await env.PROFILE_PHOTOS.put(storedKey,buffer,{httpMetadata:{contentType:png?'image/png':'image/jpeg'}});
  try{await rawDb().prepare('INSERT INTO firm_settings(key,name,banner_key,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET banner_key=excluded.banner_key,updated_at=excluded.updated_at').bind(key,name,storedKey,new Date().toISOString()).run();}catch(error){await env.PROFILE_PHOTOS.delete(storedKey);throw error;}
  return Response.json({saved:true,photoUrl:'/api/firm-logo?key='+encodeURIComponent(key)});
 }catch{return Response.json({error:'Firm image could not be uploaded. Please try again.'},{status:503});}
}
