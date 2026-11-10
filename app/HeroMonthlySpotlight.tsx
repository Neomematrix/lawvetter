'use client';
import {use,useEffect} from 'react';
import type {ComponentType} from 'react';
import type {Attorney} from './GeorgiaDirectory';
import type {DiscoveryData} from './Discovery';
import type {InitialDiscoveryData} from './DirectoryContent';
import MonthlySpotlight from './MonthlySpotlight';
import HeroSpotlightState from './HeroSpotlightState';

export type HeroSpotlightProps={initialData:InitialDiscoveryData;data:DiscoveryData|null;onData:(data:DiscoveryData)=>void;onOpen:(attorney:Attorney)=>void};
export type HeroSpotlightComponent=ComponentType<HeroSpotlightProps>;
const refreshMs=120000;

export default function HeroMonthlySpotlight({initialData,data,onData,onOpen}:HeroSpotlightProps){
 const initial=initialData&&'then' in initialData?use(initialData):initialData;
 const current=data||initial;
 useEffect(()=>{
  let last=Date.now(),controller:AbortController|undefined,timeout:ReturnType<typeof setTimeout>|undefined;
  async function refresh(){
   if(document.visibilityState==='hidden'||controller||Date.now()-last<refreshMs)return;
   last=Date.now();const request=new AbortController();controller=request;
   timeout=setTimeout(()=>request.abort(),10000);
   try{
    // Existing anonymous GETs share the edge cache and ranking snapshot; no
    // search is recorded and no per-attorney/profile lookups are introduced.
    const response=await fetch('/api/attorneys?home=1',{credentials:'omit',headers:{Accept:'application/json'},signal:request.signal});
    if(!response.ok)return;
    const next=await response.json() as DiscoveryData;
    if(!request.signal.aborted&&!next.unavailable&&Array.isArray(next.monthly)&&typeof next.monthLabel==='string')onData(next);
   }catch{/* Keep the last successful leader during temporary failures. */}
   finally{clearTimeout(timeout);controller=undefined;}
  }
  const interval=setInterval(()=>void refresh(),refreshMs),visible=()=>void refresh();
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
  return()=>{clearInterval(interval);clearTimeout(timeout);controller?.abort();document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};
 },[onData]);
 return current?.monthly?.length?<MonthlySpotlight data={current} onOpen={onOpen} variant="hero"/>:<HeroSpotlightState/>;
}
