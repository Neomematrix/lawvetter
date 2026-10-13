'use client';
import {useId,useState} from 'react';
export default function VerifiedClientBadge({anonymous=false}:{anonymous?:boolean}){
 const id=useId(),[open,setOpen]=useState(false);
 return <span className="review-verification"><span className="verified-client-badge"><img src="/verified-client-badge.png" width="22" height="22" alt=""/>Verified client</span>{anonymous&&<span className="anonymous-review-info"><button type="button" aria-label="About this anonymous verified client" aria-describedby={id} aria-expanded={open} onClick={()=>setOpen(!open)} onBlur={()=>setOpen(false)}>?</button><span id={id} role="tooltip" className={open?'is-open':''}>This user is verified but chose to remain anonymous and not display their name.</span></span>}</span>;
}
