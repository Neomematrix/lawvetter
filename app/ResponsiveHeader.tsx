'use client';
import {useEffect,useState,type MouseEvent} from 'react';
import ClientAccountNav from './ClientAccountNav';
import {useShortlist} from './Shortlist';

type HeaderView='discover'|'charts'|'shortlist';

export default function ResponsiveHeader({activeView,onNavigate}:{activeView?:HeaderView|'home';onNavigate?:(view:HeaderView,search?:boolean)=>void}){
 const [open,setOpen]=useState(false),shortlist=useShortlist();
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open]);
 const choose=(event:MouseEvent<HTMLAnchorElement>,view:HeaderView)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;setOpen(false);if(onNavigate){event.preventDefault();onNavigate(view);}};
 const brand=<img className="lawvetter-brand-logo" width={1807} height={398} src="/brand/lawvetter-logo.svg" alt="LawVetter"/>;
 const shortlistIcon=<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 2.5h10v15L10 14l-5 3.5z"/></svg>;
 return <header className="site-header discovery-header"><div className="nav-shell">
  <a className="brand" href="/" onClick={event=>choose(event,'discover')} aria-label="LawVetter home">{brand}</a>
  <button className="mobile-menu-toggle" type="button" aria-expanded={open} aria-controls="lawvetter-menu" aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(value=>!value)}><span/><span/><span/></button>
  <div className={'responsive-menu'+(shortlist.signedIn?' has-shortlist':'')+(open?' is-open':'')} id="lawvetter-menu">
   <nav aria-label="Primary navigation">
    <a className={'header-home-link'+(activeView==='home'?' active':'')} aria-current={activeView==='home'?'page':undefined} href="/" onClick={()=>setOpen(false)}>Home</a>
    <a href="/discover" className={activeView==='discover'?'active':''} aria-current={activeView==='discover'?'page':undefined} onClick={()=>setOpen(false)}>Discover</a><a href="/?view=charts" className={activeView==='charts'?'active':''} aria-current={activeView==='charts'?'page':undefined} onClick={event=>choose(event,'charts')}>Charts</a>
    <a href="/client-reviews" onClick={()=>setOpen(false)}>Reviews</a>
   </nav>
   {shortlist.signedIn&&<a className="shortlist-nav" href="/?view=shortlist" aria-current={activeView==='shortlist'?'page':undefined} onClick={event=>choose(event,'shortlist')}>{shortlistIcon}Shortlist <span>{shortlist.attorneys.length}</span></a>}
   <ClientAccountNav/>
   <a className="attorney-account-link" href="/account" onClick={()=>setOpen(false)}>For attorneys</a>
   <a className="hire-lawyer-link" href="/hire-lawyer" onClick={()=>setOpen(false)}>Find an Attorney</a>
  </div>
 </div></header>;
}
