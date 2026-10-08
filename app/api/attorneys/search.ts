// Search words must stand on their own: "Ted" must not match "United".
export function attorneyNameSearch(query: string) {
 const words = query.split(/[\s.,;:()&/"-]+/).filter(Boolean).slice(0,20);
 const escape = (s:string) => s.replace(/[\\%_]/g,'\\$&');
 const wordColumn = (column:string) => {
  let value = column;
  for (const punctuation of ['.',',',';',':','(',')','&','/','"','-']) {
   value = `replace(${value}, '${punctuation}', ' ')`;
  }
  return `lower(' ' || ${value} || ' ')`;
 };
 const patterns = words.map(w=>'% '+escape(w)+' %');
 const expression = (column:string) => words.map(()=>`${wordColumn(column)} LIKE ? ESCAPE '\\'`).join(' AND ');
 const name = expression('name'), company = expression('company');
 if(!words.length) return {where:'lower(bar_number) = ?',args:[query],order:'',orderArgs:[] as string[]};
 return {
  where:`((${name}) OR (${company}) OR lower(bar_number) = ?)`,
  args:[...patterns,...patterns,query],
  order:`CASE WHEN lower(bar_number) = ? THEN 0 WHEN (${name}) THEN 1 ELSE 2 END, `,
  orderArgs:[query,...patterns],
 };
}
