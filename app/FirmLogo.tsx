'use client';
import {useEffect,useState} from 'react';
import {firmKey} from './api/attorneys/firm';

function initials(name:string){
 const words=name.replace(/\b(llc|llp|pc|pa|pllc|inc|attorneys?|law|firm)\b/gi,' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
 return (words.length>1?words.slice(0,2):words.slice(0,1)).map(word=>word[0]).join('').toUpperCase()||'CC';
}

export default function FirmLogo({name,website}:{name:string;website?:string}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[name,website]);
 const showImage=Boolean(website)&&!failed;
 return <div className="firm-logo-block">
  <div className="firm-logo-surface">
   {showImage?<img src={'/api/firm-logo?key='+encodeURIComponent(firmKey(name))+'&v=2'} alt={name+' logo'} onError={()=>setFailed(true)}/>:<span className="firm-logo-monogram" role="img" aria-label={name+' logo'}>{initials(name)}</span>}
  </div>
 </div>;
}
