import {websitesByFirm} from '../../firm-websites';

const cacheHeaders={'Cache-Control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'};

function attribute(tag:string,name:string){
 const match=tag.match(new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));
 return match?.[1]||match?.[2]||match?.[3]||'';
}

function imageUrl(value:string,base:string){
 if(!value||value.startsWith('data:'))return '';
 try{const url=new URL(value,base);return url.protocol==='http:'||url.protocol==='https:'?url.href:'';}catch{return '';}
}

function homepageLogo(html:string,base:string){
 const candidates:{url:string;score:number}[]=[];
 for(const tag of html.match(/<img\b[^>]*>/gi)||[]){
  const description=[attribute(tag,'class'),attribute(tag,'id'),attribute(tag,'alt'),attribute(tag,'itemprop')].join(' ').toLowerCase();
  if(!/(logo|brand|identity|wordmark)/.test(description))continue;
  const raw=attribute(tag,'src')||attribute(tag,'data-src')||attribute(tag,'data-lazy-src')||attribute(tag,'data-original');
  const url=imageUrl(raw,base);if(!url)continue;
  let score=10;
  if(/site-logo|header-logo|brand-logo|wordmark/.test(description))score+=8;
  if(/footer/.test(description))score-=4;
  if(/\.svg(?:\?|$)/i.test(url))score+=3;
  candidates.push({url,score});
 }
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
  const property=[attribute(tag,'property'),attribute(tag,'name'),attribute(tag,'itemprop')].join(' ').toLowerCase();
  if(!/(^|\s)(og:logo|logo)(\s|$)/.test(property))continue;
  const url=imageUrl(attribute(tag,'content'),base);if(url)candidates.push({url,score:15});
 }
 for(const tag of html.match(/<link\b[^>]*>/gi)||[]){
  const rel=attribute(tag,'rel').toLowerCase();
  if(!/(apple-touch-icon|mask-icon|icon)/.test(rel))continue;
  const url=imageUrl(attribute(tag,'href'),base);if(url)candidates.push({url,score:rel.includes('apple-touch')?7:5});
 }
 return candidates.sort((a,b)=>b.score-a.score)[0]?.url||'';
}

export async function GET(request:Request){
 const key=new URL(request.url).searchParams.get('key')||'';
 const website=websitesByFirm[key];
 if(!website)return new Response('Firm website not found.',{status:404,headers:cacheHeaders});
 try{
  const response=await fetch(website,{redirect:'follow',signal:AbortSignal.timeout(5000),headers:{'User-Agent':'CounselCheck/1.0 firm-profile-logo'}});
  if(response.ok){
   const type=response.headers.get('content-type')||'';
   if(type.includes('text/html')){
    const logo=homepageLogo((await response.text()).slice(0,750000),response.url||website);
    if(logo)return new Response(null,{status:302,headers:{...cacheHeaders,Location:logo}});
   }
  }
 }catch{}
 const favicon='https://www.google.com/s2/favicons?domain_url='+encodeURIComponent(website)+'&sz=256';
 return new Response(null,{status:302,headers:{...cacheHeaders,Location:favicon}});
}
