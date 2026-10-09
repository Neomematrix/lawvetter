export type NewsStory={slug:string;amount:string;amountLabel:string;topic:string;date:string;sourceDate:string;title:string;summary:string;url:string;sourceName:string;status:string;publishedAt:string;familyLaw?:boolean;sections:{heading:string;text:string}[]};
export type NewsEdition={articles:NewsStory[];featured:string[];updatedAt:string|null};
export function validateEdition(value:unknown):value is Omit<NewsEdition,'updatedAt'>{
 if(!value||typeof value!=='object')return false;
 const x=value as Omit<NewsEdition,'updatedAt'>;
 if(!Array.isArray(x.articles)||x.articles.length<12||x.articles.length>10000||!Array.isArray(x.featured)||x.featured.length!==12||new Set(x.featured).size!==12)return false;
 const keys=['slug','amount','amountLabel','topic','date','sourceDate','title','summary','url','sourceName','status','publishedAt'] as const;
 for(const a of x.articles){
  if(!a||keys.some(k=>typeof a[k]!=='string'||!a[k].trim()||a[k].length>3000)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug)||!/^\d{4}-\d{2}-\d{2}$/.test(a.sourceDate)||!Number.isFinite(Date.parse(a.sourceDate))||!Number.isFinite(Date.parse(a.publishedAt)))return false;
  try{if(new URL(a.url).protocol!=='https:')return false;}catch{return false;}
  if(a.familyLaw!==undefined&&typeof a.familyLaw!=='boolean')return false;
  if(!Array.isArray(a.sections)||a.sections.length<2||a.sections.length>12||a.sections.some(s=>!s||typeof s.heading!=='string'||!s.heading.trim()||s.heading.length>300||typeof s.text!=='string'||!s.text.trim()||s.text.length>15000))return false;
 }
 const bySlug=new Map(x.articles.map(a=>[a.slug,a]));
 return bySlug.size===x.articles.length&&x.featured.every(s=>bySlug.has(s))&&x.featured.filter(s=>bySlug.get(s)?.familyLaw===true).length>=2;
}
