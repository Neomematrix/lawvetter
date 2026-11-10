'use client';
import {useEffect,useRef,useState} from 'react';
import {firmKey} from './api/attorneys/firm';

function initials(name:string){
 const words=name.replace(/\b(llc|llp|pc|pa|pllc|inc|attorneys?|law|firm)\b/gi,' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
 return (words.length>1?words.slice(0,2):words.slice(0,1)).map(word=>word[0]).join('').toUpperCase()||'LV';
}

export default function FirmLogo({name,website,banner=false,version='4',fallbackName=false,loading}:{name:string;website?:string;banner?:boolean;version?:string;fallbackName?:boolean;loading?:'lazy'|'eager'}){
 const [failed,setFailed]=useState(false),[loadedSrc,setLoadedSrc]=useState(''),[compact,setCompact]=useState(false);
 const img=useRef<HTMLImageElement>(null),src='/api/firm-logo?key='+encodeURIComponent(firmKey(name))+'&v='+encodeURIComponent(version);
 const loaded=loadedSrc===src;
 useEffect(()=>{if(img.current?.complete&&img.current.naturalWidth>0){setLoadedSrc(src);setCompact(img.current.naturalWidth<800&&img.current.naturalHeight<250);}},[src]);
 useEffect(()=>setFailed(false),[name,website]);
 const showImage=Boolean(name)&&!failed;
 if(banner&&failed&&!fallbackName)return null;
 return <div className={banner?"firm-logo-block firm-logo-banner":"firm-logo-block"} data-compact={banner&&compact?'true':undefined} style={banner&&!loaded&&!fallbackName?(loading==='lazy'?{opacity:0}:{display:'none'}):undefined}>
  <div className="firm-logo-surface">
   {fallbackName&&!loaded&&<span className="firm-logo-name">{name}</span>}
   {showImage?<img ref={img} loading={loading} decoding="async" style={fallbackName&&!loaded?{display:'none'}:undefined} src={src} onLoad={event=>{setLoadedSrc(src);setCompact(event.currentTarget.naturalWidth<800&&event.currentTarget.naturalHeight<250);}} alt={name+' logo'} onError={()=>setFailed(true)}/>:!fallbackName&&<span className="firm-logo-monogram" role="img" aria-label={name+' logo'}>{initials(name)}</span>}
  </div>
 </div>;
}
