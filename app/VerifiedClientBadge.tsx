'use client';
import {useEffect,useId,useRef,useState} from 'react';
export default function VerifiedClientBadge({anonymous=false}:{anonymous?:boolean}){
 const id=useId(),[open,setOpen]=useState(false);
 const infoRef=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  if(!open)return;
  const dismissOutside=(event:Event)=>{
   if(event.target instanceof Node&&!infoRef.current?.contains(event.target))setOpen(false);
  };
  const dismissEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
  document.addEventListener('pointerdown',dismissOutside,true);
  document.addEventListener('focusin',dismissOutside);
  document.addEventListener('keydown',dismissEscape);
  return ()=>{
   document.removeEventListener('pointerdown',dismissOutside,true);
   document.removeEventListener('focusin',dismissOutside);
   document.removeEventListener('keydown',dismissEscape);
  };
 },[open]);
 return <span className="review-verification"><span className="verified-client-badge"><img src="/verified-client-badge.png" width="22" height="22" alt=""/>Verified client</span>{anonymous&&<span className="anonymous-review-info" ref={infoRef}><button type="button" aria-label="About this anonymous verified client" aria-describedby={id} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>?</button><span id={id} role="tooltip" className={open?'is-open':''}>This user is verified but chose to remain anonymous and not display their name.</span></span>}</span>;
}
