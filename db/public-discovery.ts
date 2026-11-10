import * as runtime from 'cloudflare:workers';
import {refreshCardLanguages} from './public-card-languages';
import {discoveryData} from '../app/api/attorneys/charts';
import {currentMonth} from '../app/awards/core';
import {publicRecords} from './public-records';
import {discoverySnapshotStore,keepDiscoveryRefresh} from './public-discovery-store';
import {rankingSnapshot,rankingSlot} from './ranking-snapshot';
import type {DiscoveryData} from '../app/Discovery';
const readers=new WeakMap<D1Database,()=>Promise<DiscoveryData>>();
export function publicDiscoveryData(db:D1Database){
 let read=readers.get(db);
 if(!read){
  read=rankingSnapshot<DiscoveryData>(runtime.env.PROFILE_PHOTOS,
   async()=>await publicRecords(await discoveryData(db)) as unknown as DiscoveryData,
   keepDiscoveryRefresh,async()=>{
    // Carry forward the deployed snapshot during migration; never discard it
    // merely because the month or deployment changed.
    const store=await discoverySnapshotStore();
    const hit=await store.match(new Request('https://www.lawvetter.com/__public-snapshot/discovery/'+currentMonth()));
    if(!hit)return;
    const saved=await hit.json() as {at:number;value:DiscoveryData};
    if(!Number.isFinite(saved.at)||!saved.value?.updated)return;
    return {...saved,slot:''};
   });
  readers.set(db,read);
 }
 return read().then(data=>refreshCardLanguages(db,data)).then(data=>({...data,stale:rankingSlot(Date.parse(data.updated))<rankingSlot()}));
}
