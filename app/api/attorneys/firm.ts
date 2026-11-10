// Preserve words and legal suffixes; normalize only formatting variants.
export const firmPunctuation = [' ', '\t', '\n', '\r', '.', ',', '-', "'", '’', '/', '(', ')'];
export function firmKey(name:string){
 let key=name.trim().toLowerCase().replaceAll('&','and');
 for(const character of firmPunctuation)key=key.replaceAll(character,'');
 return key==='thriftmclemore'?'thriftmclemorellc':key;
}
export function firmColumn(column="company"){
 let expression=`replace(lower(${column}), '&', 'and')`;
 for(const character of firmPunctuation){const literal=character==='\t'?'char(9)':character==='\n'?'char(10)':character==='\r'?'char(13)':"'"+character.replaceAll("'","''")+"'";expression=`replace(${expression}, ${literal}, '')`;}
 // Explicitly reviewed alias only; legal suffixes remain significant for all other firms.
 return `CASE ${expression} WHEN 'thriftmclemore' THEN 'thriftmclemorellc' ELSE ${expression} END`;
}
