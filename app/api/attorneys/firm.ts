// Preserve words and legal suffixes; normalize only formatting variants.
export const firmPunctuation = [' ', '\t', '\n', '\r', '.', ',', '-', "'", '’', '/', '(', ')'];
export function firmKey(name:string){
 let key=name.trim().toLowerCase().replaceAll('&','and');
 for(const character of firmPunctuation)key=key.replaceAll(character,'');
 return key;
}
export function firmColumn(column="company"){
 let expression=`replace(lower(${column}), '&', 'and')`;
 for(const character of firmPunctuation)expression=`replace(${expression}, '${character.replaceAll("'","''")}', '')`;
 return expression;
}
