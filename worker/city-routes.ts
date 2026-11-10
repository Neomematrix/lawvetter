import {isVerifiedCityId} from '../app/verified-city';

// Reject fabricated locations before React starts streaming (which can turn
// a late notFound into a 200 response). Crawlers must see the real HTTP status.
export function invalidCityResponse(request:Request):Response|null{
 if(!['GET','HEAD'].includes(request.method))return null;
 const match=new URL(request.url).pathname.match(/^\/lawyers-in\/([^/]+)\/[^/]+\/?$/);
 if(!match)return null;
 let location='';try{location=decodeURIComponent(match[1]);}catch{/* malformed locations are not indexable */}
 if(isVerifiedCityId(location))return null;
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>City page not found | LawVetter</title></head><body><main><a href="/">LawVetter</a><h1>City page not found</h1><p>This city and state combination is not available in our location directory.</p><p><a href="/find-a-lawyer">Find lawyers by city or practice area</a></p></main></body></html>';
 return new Response(request.method==='HEAD'?null:html,{status:404,headers:{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, follow','Cache-Control':'no-store'}});
}
