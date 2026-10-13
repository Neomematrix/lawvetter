'use client';
import {searchPracticeArea} from './practice-areas';
import {displayBarNumber} from './attorney-identity';
import {useEffect,useState} from 'react';
import type {Attorney} from './GeorgiaDirectory';
export default function AttorneyNameInput({value,city,enabled,onChange,onSelect}:{value:string;city:string;enabled:boolean;onChange:(s:string)=>void;onSelect:(a:Attorney)=>void}){
 const [items,setItems]=useState<Attorney[]>([]),[focused,setFocused]=useState(false),[active,setActive]=useState(-1);
 useEffect(()=>{
  setItems([]);setActive(-1);
  if(!enabled||!focused||value.trim().length<2||!!searchPracticeArea(value))return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{try{
   const params=new URLSearchParams({q:value.trim(),city:city.trim(),statusGroup:'active'});
   const response=await fetch('/api/attorneys?'+params,{signal:controller.signal,credentials:'include',cache:'no-store'});
   if(!response.ok)return;
   const data=await response.json() as {attorneys?:Attorney[]};if(!controller.signal.aborted)setItems((data.attorneys||[]).slice(0,8));
  }catch{/* Ordinary search remains available if suggestions fail. */}},250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[value,city,enabled,focused]);
 const shown=enabled&&focused&&items.length>0;
 function choose(a:Attorney){setFocused(false);setItems([]);onSelect(a);}
 return <div className="attorney-autocomplete" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
  <label htmlFor="attorney-name-input" className="sr-only">{enabled?'Attorney name, firm, bar number, or practice area':'Firm name'}</label>
  <input id="attorney-name-input" value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={shown} aria-controls={shown?'attorney-suggestions':undefined} aria-activedescendant={shown&&active>=0?'attorney-option-'+active:undefined} onFocus={()=>setFocused(true)} onChange={e=>{onChange(e.target.value);setFocused(true);}} onKeyDown={e=>{
   if(e.key==='Escape'){setFocused(false);setActive(-1);}
   if(shown&&e.key==='ArrowDown'){e.preventDefault();setActive(i=>(i+1)%items.length);}
   if(shown&&e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i-1+items.length)%items.length);}
   if(shown&&e.key==='Enter'&&active>=0){e.preventDefault();choose(items[active]);}
  }} placeholder={enabled?'Attorney name, firm, bar number, or practice area':'Search law firms and legal organizations'}/>
  {shown&&<ul id="attorney-suggestions" role="listbox" aria-label="Matching attorneys">{items.map((a,i)=><li id={'attorney-option-'+i} key={a.bar_number} role="option" aria-selected={i===active} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(a)}><strong>{a.name}</strong><small>{[a.company,a.city,(a.state||'GA')+' #'+displayBarNumber(a.bar_number)].filter(Boolean).join(' · ')}</small></li>)}</ul>}
 </div>;
}
