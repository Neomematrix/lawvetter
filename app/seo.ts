export const SITE_ORIGIN='https://lawvetter.kyle-george-1801.chatgpt.site';
export const SITE_NAME='LawVetter';
export const SITE_DESCRIPTION='Find lawyers, review professional records, read verified client experiences, and compare attorneys before deciding whom to contact.';

export type AttorneyIdentity={bar_number:string;name:string};

export function slugify(value:string){
 return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}

export function attorneyPath(attorney:AttorneyIdentity){
 return '/lawyers/'+encodeURIComponent(attorney.bar_number)+'-'+slugify(attorney.name);
}

export function attorneyBarFromPath(profile:string){
 const match=decodeURIComponent(profile).match(/^((?:[A-Z]{2}:)?\d{1,20})(?:-|$)/);
 return match?.[1]||'';
}

export function absoluteUrl(path:string){return new URL(path,SITE_ORIGIN).toString();}
export function safeJsonLd(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c');}

