export function textWordSearch(query:string,column:string,match:'whole'|'prefix'='prefix') {
 const words = query.toLowerCase().split(/[\s.,;:()&/"-]+/).filter(Boolean).slice(0,20);
 const escape = (s:string) => s.replace(/[\\%_]/g,'\\$&');
 const wordColumn = (column:string) => {
  let value = column;
  for (const punctuation of ['.',',',';',':','(',')','&','/','"','-']) {
   value = `replace(${value}, '${punctuation}', ' ')`;
  }
  return `lower(' ' || ${value} || ' ')`;
 };
 // Match each partial word independently, allowing omitted middle words.
 const patterns = words.map(w=>'% '+escape(w)+(match==='prefix'||w.length===1?'%':' %'));
 // Reject nonmatching rows before applying punctuation normalization. Most
 // directory rows need only one inexpensive LIKE instead of ten REPLACEs per word.
 const contains = words.map(w=>'%'+escape(w)+'%');
 const expression = (column:string) => [
  ...words.map(()=>`${column} LIKE ? ESCAPE '\\'`),
  ...words.map(()=>`${wordColumn(column)} LIKE ? ESCAPE '\\'`),
 ].join(' AND ');
 return {where:words.length?expression(column):(query.trim()?'0':'1'),args:[...contains,...patterns]};
}

// Search words must start at word boundaries: "Ted" must not match "United".
export function attorneyNameSearch(query: string,columnPrefix:''|'a.'='',match:'whole'|'prefix'='prefix',includeCompany=true) {
 query=query.toLowerCase();
 if(/^lv[0-9a-f]{32}$/.test(query))return {where:`lower(${columnPrefix}public_id) = ?`,args:[query.slice(2)],order:'',orderArgs:[] as string[]};
 const qualified=query.match(/^([a-z]{2})[:-](\d{1,20})$/);
 const stateGuard=qualified?`CASE WHEN upper(${columnPrefix}state)='${qualified[1].toUpperCase()}' THEN `:'';
 const licenseColumn=stateGuard+`lower(COALESCE(${columnPrefix}license_number,${columnPrefix}bar_number))`+(qualified?' ELSE NULL END':'');
 const licenseQuery=query.startsWith('ga:lv')?query:query.replace(/^[a-z]{2}[:-]/,'');
 // Verified nickname: https://www.emcfamilylaw.com/staff-profiles/theodore-s-eittreim/
 // Tedd is accepted as a spelling variant of the published nickname Ted.
 const searchableName = "CASE WHEN bar_number = '231458' THEN name || ' Ted Tedd S' WHEN bar_number = '004170' THEN name || ' Randy' ELSE name END";
 const prefixedName=searchableName.replace(/\b(bar_number|name)\b/g,column=>columnPrefix+column);
 const nameSearch=textWordSearch(query,prefixedName,match),companySearch=textWordSearch(query,`(${columnPrefix}company || ' ' || ${columnPrefix}employer_name || ' ' || ${columnPrefix}employment_type)`,match);
 const name=nameSearch.where,company=companySearch.where,patterns=nameSearch.args;
 const exactName=textWordSearch(query,prefixedName,'whole'),startsWith=query.trim().replace(/[\\%_]/g,'\\$&')+' %';
 if(!patterns.length) return {where:licenseColumn+' = ?',args:[licenseQuery],order:'',orderArgs:[] as string[]};
 return {
  where:`((${name})${includeCompany?' OR ('+company+')':''} OR ${licenseColumn} = ?)`,
  args:[...patterns,...(includeCompany?patterns:[]),licenseQuery],
  order:`CASE WHEN ${licenseColumn} = ? THEN 0 WHEN lower(${columnPrefix}name) LIKE ? ESCAPE '\\' THEN 1 WHEN (${exactName.where}) THEN 2 WHEN (${name}) THEN 3 ELSE 4 END, `,
  orderArgs:[licenseQuery,startsWith,...exactName.args,...patterns],
 };
}

// Bounded candidate lookup uses the existing binary name index, never edit distance in SQL.
const nicknameGroups = [
 ['theodore','ted','tedd','teddy','theo'], ['edward','ed','eddie','ted'],
 ['robert','rob','bob','bobby'], ['william','will','bill','billy'],
 ['richard','rick','ricky','dick'], ['james','jim','jimmy'],
 ['john','jack','johnny'], ['joseph','joe','joey'], ['michael','mike','mikey'],
 ['thomas','tom','tommy'], ['daniel','dan','danny'], ['david','dave','davy'],
 ['christopher','chris'], ['nicholas','nick'], ['anthony','tony'],
 ['andrew','andy','drew'], ['stephen','steve'], ['steven','steve'],
 ['elizabeth','liz','beth','lizzy','betty'], ['katherine','kate','kathy','katie'],
 ['catherine','cathy','cate'], ['jennifer','jen','jenny'], ['susan','sue','susie'],
 ['patricia','pat','patty'], ['rebecca','becky'], ['margaret','meg','maggie','peggy'],
 ['alexander','alex'], ['alexandra','alex'], ['randall','randy'], ['randolph','randy'],
 ['benjamin','ben'], ['samuel','sam'], ['samantha','sam'], ['kenneth','ken'],
 ['ronald','ron'], ['donald','don'], ['charles','charlie','chuck'],
];
export function nameAliases(word:string) {
 return [...new Set([word,...nicknameGroups.filter(group=>group.includes(word)).flat()])].slice(0,8);
}
function oneEdit(a:string,b:string) {
 if(a===b)return true;
 if(Math.abs(a.length-b.length)>1)return false;
 if(a.length===b.length){const diff=[...a].map((c,i)=>c===b[i]?-1:i).filter(i=>i>=0);return diff.length===1 || (diff.length===2&&diff[1]===diff[0]+1&&a[diff[0]]===b[diff[1]]&&a[diff[1]]===b[diff[0]]);}
 const [short,long]=a.length<b.length?[a,b]:[b,a];let i=0;while(i<short.length&&short[i]===long[i])i++;return short.slice(i)===long.slice(i+1);
}
export function closeNameScore(query:string,name:string) {
 const words=query.toLowerCase().split(/[^a-z']+/).filter(Boolean);
 const parts=name.toLowerCase().split(/[^a-z']+/).filter(Boolean);
 if(!words.length||!parts.length)return -1;
 const aliases=nameAliases(words[0]);
 const first=parts[0]===words[0]?0:aliases.includes(parts[0])?1:words[0].length>=4&&oneEdit(words[0],parts[0])?2:-1;
 if(first<0)return -1;
 let score=first,position=1;
 for(const word of words.slice(1)){
  let found=-1,cost=0;
  for(let i=position;i<parts.length;i++){
   if(parts[i]===word||parts[i].startsWith(word)){found=i;break;}
   if(word.length>=4&&oneEdit(word,parts[i])){found=i;cost=2;break;}
  }
  if(found<0)return -1;position=found+1;score+=cost;
 }
 return score;
}
export async function closeNameCandidates(db:{prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<{results:unknown[]}[]>},query:string):Promise<string[]> {
 const words=query.toLowerCase().trim().split(/\s+/);
 if(!/^[a-z]{3,}$/.test(words[0])||words.length>5||!words.every(w=>/^[a-z']+$/.test(w)))return [];
 const aliases=nameAliases(words[0]);
 // Single names expand known nicknames only; typo matching needs a second name.
 if(words.length===1&&aliases.length===1)return [];
 const prefixes=[...new Set(aliases.map(w=>words.length>1?w.slice(0,3):w))];
 const matches:{bar_number:string;name:string;score:number}[]=[];
 const ranges=[...new Set(prefixes.flatMap(prefix=>[prefix[0].toUpperCase()+prefix.slice(1),prefix.toUpperCase(),prefix]))];
 // One D1 batch keeps each indexed range independently bounded and avoids
 // a compound SELECT with an ORDER BY/LIMIT subquery for every name variant.
 const rows=await db.batch(ranges.map(start=>db.prepare('SELECT bar_number,name FROM attorneys WHERE name >= ? AND name < ? ORDER BY name LIMIT 150').bind(start,start+'\uffff')));
 for(const result of rows)for(const row of result.results as {bar_number:string;name:string}[]){const score=closeNameScore(query,row.name);if(score>=0)matches.push({...row,score});}

 return [...new Set(matches.sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name)).map(row=>row.bar_number))].slice(0,100);
}
