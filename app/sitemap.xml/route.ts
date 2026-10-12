import {SITE_ORIGIN} from '../news/stories';
import {readNews} from '../news/store';

export async function GET(){
 const {articles}=await readNews();
 const paths=['/','/hire-lawyer','/add-listing','/disclaimer','/news',...articles.map(story=>'/news/'+story.slug)];
 const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>'<url><loc>'+SITE_ORIGIN+path+'</loc></url>').join('')+'</urlset>';
 return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
