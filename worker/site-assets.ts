// Use the live API dispatch path for release assets. Static requests can remain
// pinned to an older hosting Worker after a publication.
export async function siteAssetResponse(request:Request,assets:Fetcher):Promise<Response|null>{
 const url=new URL(request.url);
 if(!['GET','HEAD'].includes(request.method))return null;
 const released=/^\/api\/lv-assets-([0-9a-f-]{36})\//.exec(url.pathname);
 if(!released&&!url.pathname.startsWith('/api/site-assets/'))return null;
 url.pathname=released?url.pathname.replace(released[0],'/assets/'+released[1]+'/'):url.pathname.replace('/api/site-assets/','/assets/');
 const response=await assets.fetch(new Request(url,request));
 if(response.status<400){
  // Only immutable release URLs may bypass revalidation. Never apply this to
  // HTML, account/API responses, mutable public files, or failed asset fetches.
  if(released&&response.status===200&&!response.headers.has('Set-Cookie')&&
   /\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg)$/.test(url.pathname)&&
   !/text\/html/i.test(response.headers.get('Content-Type')||'')){
   const cached=new Response(response.body,response);
   cached.headers.set('Cache-Control','public, max-age=31536000, immutable');
   return cached;
  }
  return response;
 }
 const failure=new Response(response.body,response);
 failure.headers.set('Cache-Control','no-store');
 failure.headers.set('CDN-Cache-Control','no-store');
 return failure;
}
