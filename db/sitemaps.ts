import {awardArchive} from './monthly-awards';
import {activeMembershipSQL} from './active-membership';
import {ensurePublicProfileIds} from './public-profile-ids';
import {localDirectory} from './local-directory';
import {publicDirectory} from './public-directory';
import {rawDb} from './raw';
import {firmColumn} from '../app/api/attorneys/firm';
import {attorneyPath,SITE_ORIGIN} from '../app/seo';
import {practiceCatalog} from './practice-categories';
export const sitemapPageSize=10000;
export const firmSitemapQuery="SELECT min(company) AS name,max(imported_at) AS updated FROM attorneys WHERE trim(company)<>'' AND "+activeMembershipSQL()+" GROUP BY "+firmColumn();
export function escapeXml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));}
const date=(value?:string)=>{if(!value)return '';const d=new Date(value);return Number.isNaN(d.valueOf())?'':d.toISOString().slice(0,10);};
export function urlset(entries:{path:string;updated?:string}[],origin=SITE_ORIGIN){return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(e=>'<url><loc>'+escapeXml(origin+e.path)+'</loc>'+(date(e.updated)?'<lastmod>'+date(e.updated)+'</lastmod>':'')+'</url>').join('')+'</urlset>';}
export async function sitemapIndex(origin=SITE_ORIGIN){
 const db=rawDb(),[attorneys,firms]=await Promise.all([db.prepare("SELECT count(*) AS total FROM attorneys WHERE "+activeMembershipSQL()).first<{total:number}>(),db.prepare('SELECT count(*) AS total FROM ('+firmSitemapQuery+')').first<{total:number}>()]);
 const files=['pages.xml',...Array.from({length:Math.ceil((attorneys?.total||0)/sitemapPageSize)},(_,i)=>'attorneys-'+(i+1)+'.xml'),...Array.from({length:Math.ceil((firms?.total||0)/sitemapPageSize)},(_,i)=>'firms-'+(i+1)+'.xml')];
 return '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+files.map(file=>'<sitemap><loc>'+escapeXml(origin+'/sitemaps/'+file)+'</loc></sitemap>').join('')+'</sitemapindex>';
}
export async function sitemapPage(file:string,origin=SITE_ORIGIN){
 const db=rawDb();
 if(file==='pages.xml'){const catalog=await practiceCatalog(db),{markets}=await localDirectory(),local=markets.flatMap(m=>m.practices.map(p=>({path:'/lawyers-in/'+m.id+'/'+p})));return urlset([{path:'/'},{path:'/about'},{path:'/awards'},...(await awardArchive()).map(a=>({path:'/awards/'+a.month})),{path:'/find-a-lawyer'},{path:'/discover'},{path:'/client-reviews'},{path:'/account'},{path:'/hire-lawyer'},{path:'/add-listing'},{path:'/disclaimer'},{path:'/privacy'},...catalog.areas.map(a=>({path:'/practice-areas/'+a.id})),...local],origin);}
 const match=file.match(/^(attorneys|firms)-([1-9]\d{0,4})\.xml$/);if(!match)return null;const page=Number(match[2]);
 if(match[1]==='attorneys'){
  const {results}=await db.prepare("SELECT a.public_id,a.bar_number,a.name,MAX(a.imported_at,COALESCE(p.updated_at,a.imported_at),'2026-10-21') AS updated FROM attorneys a LEFT JOIN attorney_profiles p ON p.bar_number=a.bar_number WHERE "+activeMembershipSQL('a')+" ORDER BY a.bar_number LIMIT ? OFFSET ?").bind(sitemapPageSize,(page-1)*sitemapPageSize).all<{public_id:string;bar_number:string;name:string;updated:string}>();
  await ensurePublicProfileIds(results);
  return results.length?urlset(results.map(a=>({path:attorneyPath(a),updated:a.updated})),origin):null;
 }
 const {results}=await db.prepare(firmSitemapQuery+' ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?').bind(sitemapPageSize,(page-1)*sitemapPageSize).all<{name:string;updated:string}>();return results.length?urlset(results.map(f=>({path:'/firm?name='+encodeURIComponent(f.name),updated:f.updated})),origin):null;
}
