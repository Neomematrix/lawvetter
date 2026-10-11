import {websitesByFirm} from '../../firm-websites';
import {verifiedFirmLogos} from '../../verified-firm-logos';

const cacheHeaders={'Cache-Control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'};
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
 const key=new URL(request.url).searchParams.get('key')||'';
 const override=verifiedFirmLogos[key];
 if(override)return new Response(null,{status:302,headers:{...cacheHeaders,Location:override}});
 const website=websitesByFirm[key];
 if(!website)return new Response('Firm website not found.',{status:404,headers:cacheHeaders});
 try{
  const home=await readPage(website);
  if(home){
   const candidates=logoCandidates(home.html,home.url);
   const about=aboutPage(home.html,home.url);
   if(about){const page=await readPage(about);if(page)candidates.push(...logoCandidates(page.html,page.url));}
   const logo=candidates.sort((a,b)=>b.score-a.score)[0]?.url;
   if(logo)return new Response(null,{status:302,headers:{...cacheHeaders,Location:logo}});
  }
 }catch{}
 // Accuracy is more important than coverage: never substitute a favicon for a full firm logo.
 return new Response('Verified full logo not found.',{status:404,headers:cacheHeaders});
}
