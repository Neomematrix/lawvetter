'use client';
import {useState,type MouseEventHandler} from 'react';
import {attorneyPhoto} from '../attorney-photo';
export default function FirmAttorneyPhoto({bar,name,photoKey,href,onClick}:{bar:string;name:string;photoKey?:string;href?:string;onClick?:MouseEventHandler<HTMLAnchorElement>}){
 const src=attorneyPhoto(bar,photoKey),[failedSrc,setFailedSrc]=useState<string>();
 const initials=name.trim().split(/\s+/).filter(Boolean).filter(part=>!['jr.','sr.','ii','iii','iv'].includes(part.toLowerCase())).map(part=>part[0]).filter(Boolean);
 const content=<>{src&&src!==failedSrc?<img src={src} alt={name} loading="lazy" onError={()=>setFailedSrc(src)}/>:<span role="img" aria-label={name+' — photo unavailable'}>{initials.length>1?initials[0]+initials[initials.length-1]:initials[0]||'?'}</span>}</>;
 return href?<a className="firm-attorney-photo" href={href} onClick={onClick} aria-label={"View "+name+" profile"}>{content}</a>:<div className="firm-attorney-photo">{content}</div>;
}
