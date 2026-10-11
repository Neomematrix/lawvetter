'use client';
import {useEffect,useState} from 'react';
import ClientAccountNav from './ClientAccountNav';
import {useShortlist} from './Shortlist';

type HeaderView='discover'|'charts'|'shortlist';

export default function ResponsiveHeader({activeView,onNavigate}:{activeView?:HeaderView;onNavigate?:(view:HeaderView)=>void}){
 const [open,setOpen]=useState(false),shortlist=useShortlist();
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open]);
 const choose=(view:HeaderView)=>{setOpen(false);onNavigate?.(view);};
 const brand=<><span className="brand-emblem brand-emblem-left" aria-hidden="true"/><span className="brand-wordmark">Counsel<span>Check</span></span><span className="brand-emblem brand-emblem-right" aria-hidden="true"/></>;
 return <header className="site-header discovery-header"><div className="nav-shell">
  {onNavigate?<button className="brand" onClick={()=>choose('discover')} aria-label="CounselCheck home">{brand}</button>:<a className="brand" href="/" aria-label="CounselCheck home">{brand}</a>}
  <button className="mobile-menu-toggle" type="button" aria-expanded={open} aria-controls="counselcheck-menu" aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(value=>!value)}><span/><span/><span/></button>
  <div className={'responsive-menu'+(open?' is-open':'')} id="counselcheck-menu">
   <nav aria-label="Primary navigation">
    {onNavigate?<><button className={activeView==='discover'?'active':''} onClick={()=>choose('discover')}>Discover</button><button className={activeView==='charts'?'active':''} onClick={()=>choose('charts')}>Charts</button></>:<><a href="/" onClick={()=>setOpen(false)}>Discover</a><a href="/?view=charts" onClick={()=>setOpen(false)}>Charts</a></>}
    <a href="/news" onClick={()=>setOpen(false)}>Legal news</a>
   </nav>
   {onNavigate?<button className="shortlist-nav" onClick={()=>choose('shortlist')}>Your shortlist <span>{shortlist.attorneys.length}</span></button>:<a className="shortlist-nav" href="/?view=shortlist" onClick={()=>setOpen(false)}>Your shortlist <span>{shortlist.attorneys.length}</span></a>}
   <ClientAccountNav/>
   <a className="attorney-account-link" href="/account" onClick={()=>setOpen(false)}>For attorneys</a>
   <a className="hire-lawyer-link" href="/hire-lawyer" onClick={()=>setOpen(false)}>Find an Attorney</a>
  </div>
 </div></header>;
}
