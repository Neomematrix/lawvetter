import {env} from 'cloudflare:workers';
import {withSitemapRefreshLease} from './sitemap-refresh-lease';
import {publicSnapshot} from './public-snapshot';
import {discoverySnapshotStore,keepDiscoveryRefresh} from './public-discovery-store';
import {sitemapIndex,sitemapPage} from './sitemaps';
import {siteOrigin} from './site-settings';
// Durable public XML survives releases and edge-cache eviction. Only successful
// generations are saved. Refresh after one hour; retain the last good copy for
// at most one day when D1 is unavailable. An R2 lease spaces heavy regenerations
// across all isolates and all sitemap files, including simultaneous crawler visits.
const readers=new Map<string,()=>Promise<string|null>>();
export function savedSitemap(file:string):Promise<string|null>{
 if(file!=='index.xml'&&file!=='pages.xml'&&!/^(attorneys|firms)-([1-9]\d{0,4})\.xml$/.test(file))return Promise.resolve(null);
 let read=readers.get(file);
 if(!read){
  read=publicSnapshot(()=>withSitemapRefreshLease(env.PROFILE_PHOTOS,async()=>{const origin=await siteOrigin();return file==='index.xml'?sitemapIndex(origin):sitemapPage(file,origin);}),()=>discoverySnapshotStore('sitemaps-v1'),()=>`https://lawvetter.local/sitemap-snapshots/${file}`,3600000,86400000,keepDiscoveryRefresh);
  // Bound attacker-controlled page keys and memory retained by an isolate.
  if(readers.size>=64)readers.delete(readers.keys().next().value!);
  readers.set(file,read);
 }
 return read();
}
