import {SITE_ORIGIN} from '../seo';
export function GET(){return new Response('User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /admin/\nDisallow: /api/\nSitemap: '+SITE_ORIGIN+'/sitemap.xml\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});}
