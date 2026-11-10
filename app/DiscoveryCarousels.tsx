'use client';
import {useEffect,useRef,useState,type FocusEvent} from 'react';
import {AttorneyCard} from './AttorneyCard';
import {homePortrait} from './home-image';
import {attorneyPhoto} from './attorney-photo';
import {bindCarouselSwipe} from './carousel-swipe';
import type {Attorney} from './GeorgiaDirectory';
function useRotation(length:number,delay:number,enabled=true,startIndex=0){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hover,setHover]=useState(false),[focused,setFocused]=useState(false),[reduced,setReduced]=useState(true);
 useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
 const move=(step:number)=>setIndex(i=>length?(i+step+length)%length:0);
 useEffect(()=>{if(!enabled||paused||hover||focused||reduced||length<2)return;const timer=window.setInterval(()=>{if(!document.hidden)setIndex(i=>(i+1)%length);},delay);return()=>window.clearInterval(timer);},[length,delay,paused,hover,focused,reduced,enabled]);
 return {index:length?(index+startIndex)%length:0,paused:paused||reduced,move,toggle:()=>{if(reduced){setReduced(false);setPaused(false);}else setPaused(v=>!v);},handlers:{onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),onFocusCapture:()=>setFocused(true),onBlurCapture:(event:FocusEvent<HTMLDivElement|HTMLElement>)=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}}};
}
function Controls({rotation,label,count}:{rotation:ReturnType<typeof useRotation>;label:string;count:number}){return <div className="carousel-controls" style={{marginLeft:'auto'}}><button className="outline-button" onClick={()=>rotation.move(-1)} disabled={count<2} aria-label={'Previous '+label}>‹ <span>Previous</span></button><span>{rotation.index+1} / {count}</span><button className="outline-button" onClick={rotation.toggle} disabled={count<2} aria-label={(rotation.paused?'Play ':'Pause ')+label}>{rotation.paused?'Play':'Pause'}</button><button className="outline-button" onClick={()=>rotation.move(1)} disabled={count<2} aria-label={'Next '+label}><span>Next</span> ›</button></div>;}
export function PopularAttorneys({attorneys,onOpen,featuredAttorneyId}:{featuredAttorneyId?:string;attorneys:(Attorney&{rank?:number})[];onOpen:(a:Attorney)=>void}){
 const [mobile,setMobile]=useState(false);
 const stage=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{const media=window.matchMedia('(max-width:700px)');const update=()=>setMobile(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const size=mobile?1:4,pages=Math.ceil(attorneys.length/size),rotation=useRotation(pages,7000,!mobile,mobile&&attorneys.length>1&&!!featuredAttorneyId&&attorneys[0].bar_number===featuredAttorneyId?1:0);
 useEffect(()=>{if(pages<2)return;if(!stage.current)return;const next=((rotation.index+1)%pages)*size;const images:HTMLImageElement[]=[];const observer=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();for(const a of attorneys.slice(next,next+size)){const src=attorneyPhoto(a.bar_number,a.photo_key);if(!src)continue;const photo=homePortrait(a,'card');const image=new Image();image.decoding='async';if(photo.srcSet)image.srcset=photo.srcSet;if(photo.sizes)image.sizes=photo.sizes;image.src=photo.src||src;images.push(image);}},{rootMargin:'200px'});observer.observe(stage.current);return()=>{observer.disconnect();for(const image of images)image.onload=null;};},[attorneys,rotation.index,pages,size]);
 useEffect(()=>{if(mobile&&stage.current)return bindCarouselSwipe(stage.current,rotation.move);},[mobile,pages]);
 return <div className="popular-carousel" role="region" aria-roledescription="carousel" aria-label="Most searched attorneys" {...rotation.handlers}>
  <div className="popular-carousel-stage" ref={stage}>
   <button type="button" className="carousel-edge-arrow carousel-edge-previous" onClick={()=>rotation.move(-1)} disabled={pages<2} aria-label="Previous attorney slide"><span aria-hidden="true">‹</span></button>
   <div className="popular-carousel-grid" aria-live={mobile||rotation.paused?'polite':'off'}>{attorneys.map((a,index)=><AttorneyCard showLanguages carouselSlot={index%size} inactive={Math.floor(index/size)!==rotation.index} key={a.bar_number} attorney={a} photo={homePortrait(a,'card')} onOpen={onOpen}/>)}</div>
   <button type="button" className="carousel-edge-arrow carousel-edge-next" onClick={()=>rotation.move(1)} disabled={pages<2} aria-label="Next attorney slide"><span aria-hidden="true">›</span></button>
  </div>
  <div className="carousel-footer">{mobile&&<p>Swipe left or right to browse attorneys</p>}
   {mobile?<div className="mobile-attorney-controls"><button type="button" className="outline-button" onClick={()=>rotation.move(-1)} disabled={pages<2} aria-label="Previous attorney">‹ Previous</button><span role="status" aria-live="polite">{pages?rotation.index+1:0} of {pages}</span><button type="button" className="outline-button" onClick={()=>rotation.move(1)} disabled={pages<2} aria-label="Next attorney">Next ›</button></div>:<Controls rotation={rotation} label="attorney slide" count={pages}/>}
  </div>
 </div>;
}
