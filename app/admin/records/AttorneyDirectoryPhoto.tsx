'use client';
import {useState} from 'react';
import {attorneyPhoto} from '../../attorney-photo';

export default function AttorneyDirectoryPhoto({bar,name,photoKey}:{bar:string;name:string;photoKey?:string|null}){
 const src=attorneyPhoto(bar,photoKey),[failedSrc,setFailedSrc]=useState<string>();
 const parts=name.trim().split(/\s+/).filter(Boolean);
 const initials=parts.length>1?parts[0][0]+parts[parts.length-1][0]:parts[0]?.[0]||'?';
 return <span className="admin-directory-photo">{src&&src!==failedSrc?<img src={src} alt="" width={46} height={54} loading="lazy" decoding="async" onError={()=>setFailedSrc(src)}/>:<span role="img" aria-label={'Photo unavailable for '+name}>{initials.toUpperCase()}</span>}</span>;
}
