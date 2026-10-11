'use client';
import {useEffect,useState} from 'react';
import GeorgiaDirectory from './GeorgiaDirectory';
import type {View,DiscoveryData} from './Discovery';
import ResponsiveHeader from './ResponsiveHeader';
export default function Home({initialHome}:{initialHome:DiscoveryData|null}){
 const [view,setView]=useState<View>('discover'),[key,setKey]=useState(0);
 useEffect(()=>{const v=new URLSearchParams(window.location.search).get('view');if(v==='charts'||v==='shortlist')setView(v);},[]);
 function navigate(next:View){setView(next);setKey(k=>k+1);window.history.replaceState(null,'',next==='discover'?'/':'/?view='+next);window.scrollTo({top:0,behavior:'smooth'});}
 return <main><ResponsiveHeader activeView={view} onNavigate={navigate}/><GeorgiaDirectory key={key} initialHome={initialHome} view={view} onView={navigate}/></main>;
}
