import {rawDb} from '../../db/raw';
import {practiceSources} from '../practice-areas';
import {readNews} from '../news/store';
import {practiceGuides} from '../practice-guides';
import {SITE_ORIGIN,attorneyPath} from '../seo';

type SitemapAttorney={bar_number:string;name:string;imported_at:string};
const escapeXml=(value:string)=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]!));
const dateOnly=(value?:string)=>{if(!value)return '';const date=new Date(value);return Number.isNaN(date.valueOf())?'':date.toISOString().slice(0,10);};

export async function GET(){
 const {articles}=await readNews();
 const staticPaths=['/','/find-a-lawyer',...Object.keys(practiceGuides).map(slug=>'/practice-areas/'+slug),'/hire-lawyer','/client-reviews','/add-listing','/disclaimer','/news'];
 let attorneys:SitemapAttorney[]=[];
 try{
  const curated=JSON.stringify(Object.keys(practiceSources));
  const result=await rawDb().prepare("SELECT a.bar_number,a.name,a.imported_at FROM attorneys a WHERE a.bar_number IN (SELECT value FROM json_each(?)) OR a.bar_number IN (SELECT bar_number FROM attorney_profiles) OR a.bar_number IN (SELECT bar_number FROM attorney_search_events WHERE created_at>=datetime('now','-90 days')) ORDER BY a.name COLLATE NOCASE LIMIT 1000").bind(curated).all<SitemapAttorney>();
  attorneys=result.results;
 }catch(error){console.error('Attorney sitemap entries unavailable',error);}
 const entries=[...staticPaths.map(path=>({path,lastmod:''})),...articles.map(story=>({path:'/news/'+story.slug,lastmod:dateOnly(story.publishedAt)})),...attorneys.map(attorney=>({path:attorneyPath(attorney),lastmod:dateOnly(attorney.imported_at)}))];
 const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(({path,lastmod})=>'<url><loc>'+escapeXml(SITE_ORIGIN+path)+'</loc>'+(lastmod?'<lastmod>'+lastmod+'</lastmod>':'')+'</url>').join('')+'</urlset>';
 return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
