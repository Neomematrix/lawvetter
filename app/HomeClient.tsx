'use client';
import ClientAccountNav from './ClientAccountNav';
import {useEffect,useState} from 'react';
import GeorgiaDirectory from './GeorgiaDirectory';
import type {View,DiscoveryData} from './Discovery';
import {useShortlist} from './Shortlist';
export default function Home({initialHome}:{initialHome:DiscoveryData|null}){
 const [view,setView]=useState<View>('discover'),[key,setKey]=useState(0),shortlist=useShortlist();
 useEffect(()=>{const v=new URLSearchParams(window.location.search).get('view');if(v==='charts'||v==='shortlist')setView(v);},[]);
 function navigate(next:View){setView(next);setKey(k=>k+1);window.history.replaceState(null,'',next==='discover'?'/':'/?view='+next);window.scrollTo({top:0,behavior:'smooth'});}
 return <main><header className="site-header discovery-header"><div className="nav-shell"><button className="brand" onClick={()=>navigate('discover')} aria-label="CounselCheck home"><span className="brand-emblem brand-emblem-left" aria-hidden="true"/><span className="brand-wordmark">Counsel<span>Check</span></span><span className="brand-emblem brand-emblem-right" aria-hidden="true"/></button><nav aria-label="Primary navigation"><button className={view==='discover'?'active':''} onClick={()=>navigate('discover')}>Discover</button><button className={view==='charts'?'active':''} onClick={()=>navigate('charts')}>Charts</button><a href="/news">Legal news</a></nav><button className="shortlist-nav" onClick={()=>navigate('shortlist')}>Your shortlist <span>{shortlist.attorneys.length}</span></button><ClientAccountNav/><a className="attorney-account-link" href="/account">For attorneys</a><a className="hire-lawyer-link" href="/hire-lawyer">Find an Attorney</a></div></header><GeorgiaDirectory key={key} initialHome={initialHome} view={view} onView={navigate}/></main>;
}
