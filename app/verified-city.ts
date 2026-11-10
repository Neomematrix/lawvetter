import {usCities} from './us-cities';
import {stateSearch} from './us-states';
import {slugify} from './seo';

// Licensing state is not evidence of office location. Only publish local
// landing pages for pairs present in the same sourced catalog as city search.
// Do not guess a replacement state: many US cities share their names.
const citiesByState=new Map(Object.entries(usCities).map(([state,cities])=>[state,new Map(cities.map(city=>[city.trim().toLowerCase(),city]))]));
const locationIds=new Set(Object.entries(usCities).flatMap(([state,cities])=>cities.map(city=>slugify(city)+'-'+state.toLowerCase())));
export function verifiedCity(city:string,state:string){
 const code=stateSearch(state),name=citiesByState.get(code)?.get(city.trim().toLowerCase());
 return name?{city:name,state:code,id:slugify(name)+'-'+code.toLowerCase()}:null;
}
export function isVerifiedCityId(id:string){return locationIds.has(id);}
