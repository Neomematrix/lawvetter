import critical from './landing-critical.json';

export function isLandingDocument(request:Request){
 const url=new URL(request.url),view=url.searchParams.get('view');
 return request.method==='GET'&&url.pathname==='/'&&(!view||view==='charts')&&
  request.headers.get('rsc')!=='1'&&!request.headers.has('next-router-state-tree')&&
  !request.headers.has('next-router-prefetch')&&!url.searchParams.has('_rsc')&&
  !request.headers.get('accept')?.includes('text/x-component');
}

// Stream the document; never buffer it or wait for data-dependent chart rows.
// Discover and every other route retain their existing response and CSS path.
export function landingPerformanceResponse(request:Request,response:Response){
 if(!isLandingDocument(request)||response.status!==200||!response.headers.get('Content-Type')?.includes('text/html'))return response;
 let inserted=false;
 return new HTMLRewriter().on('link[rel="stylesheet"]',{
  element(element){
   const href=element.getAttribute('href')||'';
   if(!/\/(?:index|Charts)-[^/]+\.css(?:\?|$)/.test(href))return;
   if(!inserted){element.before('<style data-lawvetter-critical>'+critical.css+'</style>',{html:true});inserted=true;}
   // Keep the original URL for caching and full cascade; an ordinary link in
   // noscript covers disabled JavaScript. The inline copy already styles the
   // header, hero, charts, search, navigation states and below-fold home view.
   element.before('<noscript><link rel="stylesheet" href="'+href.replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></noscript>',{html:true});
   element.setAttribute('media','print');
   element.setAttribute('onload',"this.media='all';this.onload=null");
   element.setAttribute('fetchpriority','low');
  }
 }).transform(response);
}
