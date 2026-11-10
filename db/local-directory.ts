import {publicReadCache} from './public-read-cache';
import {cache} from 'react';
import {rawDb} from './raw';
import {activeMembershipSQL} from './active-membership';
import {practiceCatalog} from './practice-categories';
import {practiceSources} from '../app/practice-areas';
import {verifiedCity} from '../app/verified-city';
const readLocalDirectory=publicReadCache(async()=>{
 const db=rawDb(),catalog=await practiceCatalog(db);
 // Only attorneys with a known practice can contribute a city. Do not scan
 // the entire imported directory to build an optional navigation list.
 const candidates=[...new Set([...Object.keys(practiceSources),...[...catalog.bars.values()].flatMap(bars=>[...bars])])];
 const {results}=await db.prepare("SELECT a.bar_number,a.city,a.state,a.owner_edited,EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=a.bar_number) AS has_profile FROM attorneys a WHERE "+activeMembershipSQL('a')+" AND a.bar_number IN (SELECT value FROM json_each(?)) AND trim(a.city)<>'' ORDER BY a.city COLLATE NOCASE").bind(JSON.stringify(candidates)).all<{bar_number:string;city:string;state:string;owner_edited:number;has_profile:number}>();
 const assigned=new Map<string,Set<string>>();
 for(const [practice,bars] of catalog.bars)for(const bar of bars){if(!assigned.has(bar))assigned.set(bar,new Set());assigned.get(bar)!.add(practice);}
 const markets=new Map<string,{id:string;city:string;state:string;name:string;practices:string[]}>();
 for(const row of results){const location=verifiedCity(row.city,row.state);if(!location)continue;const {city,state,id}=location;
 const practices=new Set(assigned.get(row.bar_number)||[]);
 if(!(row.owner_edited===1&&row.has_profile))for(const p of practiceSources[row.bar_number]?.areas||[])practices.add(p);
 const valid=[...practices].filter(p=>p!=='judge'&&catalog.areas.some(a=>a.id===p));if(!valid.length)continue;
 const market=markets.get(id)||{id,city,state,name:city+', '+state,practices:[]};
 market.practices=[...new Set([...market.practices,...valid])].sort();markets.set(id,market);
 }
 return {markets:[...markets.values()],areas:catalog.areas};
},60000,5000);
export const localDirectory=cache(readLocalDirectory);
