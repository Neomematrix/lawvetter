import counties from './location-counties.json';
import courts from './location-courts-ga.json';

const countyData:Record<string,string[]>=counties;
const courtData:Record<string,string[]>=courts;
export function normalizeLocation(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function countyKey(value:string){return normalizeLocation(value).replace(/ county$/,'');}
export function narrowLocations(options:string[],query:string){
 const q=normalizeLocation(query),words=q.split(' ').filter(Boolean);
 return options.filter(name=>words.every(word=>normalizeLocation(name).includes(word))).sort((a,b)=>Number(normalizeLocation(b).startsWith(q))-Number(normalizeLocation(a).startsWith(q))||a.localeCompare(b)).slice(0,12);
}
export function countyOptions(state:string,query:string){return narrowLocations(countyData[state]||[],query);}
export function courtOptions(state:string,county:string,query:string){
 if(state!=='GA')return [];
 const key=Object.keys(courtData).find(name=>countyKey(name)===countyKey(county));
 return narrowLocations(key?courtData[key]:[],query);
}
