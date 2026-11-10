export function firmReturnTarget(search:string,referrer:string,origin:string){
 function local(value:string){
  if(!value||value.length>4000||/[\\\r\n]/.test(value))return null;
  try{const url=new URL(value,origin);if(url.origin!==origin||url.pathname==='/firm')return null;return url.pathname+url.search+url.hash;}catch{return null;}
 }
 const requested=new URLSearchParams(search).get('returnTo')||'';
 let href=(requested.startsWith('/')&&!requested.startsWith('//')?local(requested):null)||local(referrer)||'/discover';
 const url=new URL(href,origin),charts=url.searchParams.get('view')==='charts';
 if(url.pathname==='/'&&!charts)href='/discover';
 const label=charts?(url.searchParams.get('chartKind')==='firms'?'Back to firm charts':'Back to attorney charts'):href==='/discover'?'Back to attorney search':url.pathname==='/discover'?'Back to search results':'Back to previous page';
 return {href,label};
}
