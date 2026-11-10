/** Public attribution only; full verification identity stays private. */
export function reviewAuthor(name:unknown, firstName:unknown='', lastName:unknown=''):string {
 const clean=(value:unknown)=>typeof value==='string'?value.trim().replace(/\s+/gu,' '):'';
 const parts=clean(name).split(' ').filter(Boolean);
 const first=clean(firstName)||parts[0]||'';
 const last=clean(lastName)||(parts.length>1?parts[parts.length-1]:'');
 return first ? first+(last?' '+Array.from(last)[0].toLocaleUpperCase()+'.':'') : 'Client';
}
