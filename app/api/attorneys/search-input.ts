// D1 permits 100 bindings and 50 UTF-8 bytes per LIKE pattern. Validate before
// catalog/identity reads; never silently truncate a search into a different one.
export function searchInputError(parameters:Record<string,string>){
 const bytes=(value:string)=>new TextEncoder().encode(value).length;
 const escape=(value:string)=>value.replace(/[\\%_]/g,'\\$&');
 const q=(parameters.q||'').trim().toLowerCase();
 if(q.split(/[\s.,;:()&/"-]+/).filter(Boolean).length>5||bytes(escape(q))>47)return 'Use a shorter name or fewer search keywords.';
 const city=(parameters.city||'').trim().toLowerCase();
 if(bytes(escape(city))>47)return 'Use a shorter city or state name.';
 if((parameters.firm||'').length>500)return 'Use a shorter firm name.';
 return '';
}
