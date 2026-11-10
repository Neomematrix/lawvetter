import {publicReadCache} from './public-read-cache';
import {env} from 'cloudflare:workers';
import {rawDb} from './raw';
import {SITE_ORIGIN} from '../app/seo';
export type PublicSettings={origin:string;gaMeasurementId:string;googleVerification:string;bingVerification:string};
export const defaultPublicSettings:PublicSettings={origin:SITE_ORIGIN,gaMeasurementId:'',googleVerification:'',bingVerification:''};
let lastKnownSettings:PublicSettings|undefined;
let runtimeDefaults=defaultPublicSettings;
async function loadPublicSettings():Promise<PublicSettings>{const runtime=env as unknown as {GA_MEASUREMENT_ID?:string;NEXT_PUBLIC_GA_MEASUREMENT_ID?:string;PUBLIC_SITE_ORIGIN?:string;GOOGLE_SITE_VERIFICATION?:string;BING_SITE_VERIFICATION?:string},id=(runtime.GA_MEASUREMENT_ID||runtime.NEXT_PUBLIC_GA_MEASUREMENT_ID||'').trim().toUpperCase(),origin=runtime.PUBLIC_SITE_ORIGIN||SITE_ORIGIN,defaults={...defaultPublicSettings,origin:['https://www.lawvetter.com','https://lawvetter.com',SITE_ORIGIN].includes(origin)?origin:SITE_ORIGIN,gaMeasurementId:/^G-[A-Z0-9]{5,20}$/.test(id)?id:'',googleVerification:runtime.GOOGLE_SITE_VERIFICATION||'',bingVerification:runtime.BING_SITE_VERIFICATION||''};runtimeDefaults=defaults;let row:{value:string}|null;try{row=await settingsDeadline(rawDb().prepare("SELECT value FROM site_settings WHERE key='public'").first<{value:string}>());}catch(error){console.error('Public settings unavailable; using last known settings',error);return lastKnownSettings||defaults;}if(!row)return defaults;try{const stored=JSON.parse(row.value);const settings:PublicSettings={...defaults,...stored,gaMeasurementId:stored.gaMeasurementId||defaults.gaMeasurementId};lastKnownSettings=settings;return settings;}catch{return defaults;}}
const readSettings=publicReadCache(loadPublicSettings,15000,2500);
export const publicSettings=Object.assign(async()=>{
 try{return await readSettings();}catch(error){console.warn('Public settings request expired',error);return lastKnownSettings||runtimeDefaults;}
},{clear:()=>readSettings.clear()});
export async function siteOrigin(){return (await publicSettings()).origin;}
export const projectId='appgprj_6a6416fbfdb48191a9d9d97e6d107e4b';

// Settings run before the page shell in middleware and metadata. A stalled
// database read must not hold every page request open indefinitely.
function settingsDeadline<T>(work:Promise<T>):Promise<T>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Public settings read timed out')),1500);
  work.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
 });
}
