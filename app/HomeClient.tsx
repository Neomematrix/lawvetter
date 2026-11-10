'use client';
import {useEffect,useLayoutEffect,useState} from 'react';
import {directoryLocation} from './directory-navigation';
import GeorgiaDirectory from './GeorgiaDirectory';
import type {View} from './Discovery';
import type {HeroSpotlightComponent} from './HeroMonthlySpotlight';
import type {DirectoryViewComponent,InitialDiscoveryData} from './DirectoryContent';
import ResponsiveHeader from './ResponsiveHeader';
export default function Home({initialHome,initialContent,initialView='discover',initialHero}:{initialHome:InitialDiscoveryData;initialContent:DirectoryViewComponent;initialView?:View;initialHero?:HeroSpotlightComponent}){
 const [view,setView]=useState<View>(initialView),[key,setKey]=useState(0);
 useEffect(()=>{const sync=()=>{setView(directoryLocation(window.location.search).view);setKey(k=>k+1);};window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
 function navigate(next:View,search=false){setView(next);setKey(k=>k+1);window.history.pushState({},'',next==='discover'?(search?'/#attorney-search':'/'):'/?view='+next);}
 // Reset after the new view commits; smooth scrolling before render can be
 // interrupted by the old page disappearing, especially in mobile Safari.
 useLayoutEffect(()=>{
  if(window.location.hash)return;
  const reset=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
  reset();
  const frame=window.requestAnimationFrame(reset);
  return()=>window.cancelAnimationFrame(frame);
 },[view,key]);
 useEffect(()=>{
  const previous=window.history.scrollRestoration;
  window.history.scrollRestoration='manual';
  return()=>{window.history.scrollRestoration=previous;};
 },[]);
 useEffect(()=>{if(view!=='discover'||window.location.hash!=='#attorney-search')return;const frame=window.requestAnimationFrame(()=>document.getElementById('attorney-search')?.scrollIntoView({behavior:'smooth',block:'start'}));return()=>window.cancelAnimationFrame(frame);},[view,key]);
 return <><ResponsiveHeader activeView={view==='discover'?'home':view} onNavigate={navigate}/><main className={view==='charts'?'charts-view':undefined}>{view==='charts'&&<style>{'.charts-view .discovery-loading{min-height:100vh}'}</style>}<GeorgiaDirectory key={key} initialHome={initialHome} initialHero={initialHero} initialContent={initialContent} initialContentView={initialView} view={view} onView={navigate}/></main></>;
}
