export const SITE_ORIGIN='https://www.lawvetter.com';
export const SITE_NAME='LawVetter';
export const SITE_DESCRIPTION='LawVetter is a lawyer directory and verified client review platform. Find lawyers by location or practice area, compare profiles, and read client experiences.';

export type AttorneyIdentity={bar_number:string;name:string;public_id?:string|null};

export function slugify(value:string){
 return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}

export function attorneyPath(attorney:AttorneyIdentity){
 return attorney.public_id?'/lawyers/'+slugify(attorney.name)+'-lv-'+attorney.public_id:'/attorney?bar='+encodeURIComponent(attorney.bar_number);
}

export function attorneyPublicIdFromPath(profile:string){
 try{return decodeURIComponent(profile).match(/-lv-([0-9a-f]{32})$/)?.[1]||'';}catch{return '';}
}

export function attorneyBarFromPath(profile:string){
 try{const match=decodeURIComponent(profile).match(/^((?:[A-Z]{2}:)?\d{1,20}|[A-Z]{2}:LV[0-9a-f]{1,64})(?:-|$)/);return match?.[1]||'';}catch{return '';}
}

// Route parameters may already be decoded by the framework. Compare equivalent segments.
export function isCanonicalAttorneyProfile(profile:string,attorney:AttorneyIdentity){
 try{return decodeURIComponent(profile)===decodeURIComponent(attorneyPath(attorney).slice('/lawyers/'.length));}catch{return false;}
}

export function absoluteUrl(path:string){return new URL(path,SITE_ORIGIN).toString();}
export function safeJsonLd(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c');}

