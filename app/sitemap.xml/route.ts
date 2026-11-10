import {savedSitemap} from '../../db/sitemap-snapshot';
export async function GET(){try{return new Response(await savedSitemap('index.xml'),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});}catch{return new Response('Sitemap temporarily unavailable',{status:503,headers:{'Retry-After':'30','Cache-Control':'no-store'}});}}
