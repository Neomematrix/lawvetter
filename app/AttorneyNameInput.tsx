'use client';
import {searchPracticeArea} from './practice-catalog';
import {useEffect,useState} from 'react';
import type {Attorney} from './GeorgiaDirectory';
type Firm={name:string;firm_key:string;attorneys:number};
type Practice={id:string;name:string;description:string};
type Suggestion={kind:'attorney';attorney:Attorney}|{kind:'firm';firm:Firm}|{kind:'practice';practice:Practice};
export default function AttorneyNameInput({value,city,enabled,onChange,onSelect,onSelectFirm,kind='attorneys',placeholder,label,emptyMessage,restoreFocus=false,practices}:{kind?:'attorneys'|'firms';value:string;city:string;enabled:boolean;onChange:(s:string)=>void;onSelect:(a:Attorney)=>void;onSelectFirm?:(firm:Firm)=>void;placeholder?:string;label?:string;emptyMessage?:string;restoreFocus?:boolean;practices?:Practice[]}){
 const [items,setItems]=useState<Suggestion[]>([]),[focused,setFocused]=useState(false),[active,setActive]=useState(-1),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const words=value.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const practiceMatches=kind==='attorneys'&&value.trim().length>=2?(practices||[]).filter(area=>words.every(word=>(area.name+' '+area.description).toLowerCase().includes(word))).slice(0,5):[];
 const suggestions:Suggestion[]=[...practiceMatches.map((practice):Suggestion=>({kind:'practice',practice})),...items];
 useEffect(()=>{if(restoreFocus&&document.activeElement?.id==='attorney-name-input')setFocused(true);},[restoreFocus]);
 useEffect(()=>{
  setItems([]);setActive(-1);setLoading(false);setFailed(false);
  if(!enabled||!focused||value.trim().length<2||(kind==='attorneys'&&(!!searchPracticeArea(value)||(practices||[]).some(area=>area.name.toLowerCase()===value.trim().toLowerCase()))))return;
  const controller=new AbortController();
  setLoading(true);
  const timer=setTimeout(async()=>{
   const params=new URLSearchParams({q:value.trim(),city:city.trim(),statusGroup:'all',suggest:'1',kind});
   const read=async(firms:boolean)=>{
    try{
     const response=await fetch('/api/attorneys?'+params,{signal:controller.signal,credentials:'include',cache:'no-store'});
     if(!response.ok)throw new Error('Suggestions unavailable');
     const data=await response.json() as {attorneys?:Attorney[];firms?:Firm[]};
     if(controller.signal.aborted)return;
     const incoming:Suggestion[]=firms?(data.firms||[]).map(firm=>({kind:'firm',firm})):(data.attorneys||[]).map(attorney=>({kind:'attorney',attorney}));
     setItems(previous=>[...previous,...incoming].sort((a,b)=>Number(a.kind==='firm')-Number(b.kind==='firm')));
    }catch{if(!controller.signal.aborted)setFailed(true);}
   };
   await read(kind==='firms');
   if(!controller.signal.aborted)setLoading(false);
  },200);
  return()=>{clearTimeout(timer);controller.abort();};
 },[value,city,enabled,focused,kind,practices]);
 const shown=enabled&&focused&&suggestions.length>0;
 function choose(item:Suggestion){setFocused(false);setItems([]);setActive(-1);if(item.kind==='practice')onChange(item.practice.name);else if(item.kind==='firm')onSelectFirm?.(item.firm);else onSelect(item.attorney);}
 return <div className="attorney-autocomplete" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
  <label htmlFor="attorney-name-input" className="sr-only">{label||(kind==='firms'?'Firm name':'Lawyer name, bar number, or practice area')}</label>
  <input id="attorney-name-input" value={value} autoComplete="off" autoCorrect="off" spellCheck={false} role="combobox" aria-autocomplete="list" aria-expanded={shown} aria-controls={shown?'attorney-suggestions':undefined} aria-activedescendant={shown&&active>=0&&active<suggestions.length?'attorney-option-'+active:undefined} onFocus={()=>setFocused(true)} onChange={e=>{onChange(e.target.value);setFocused(true);}} onKeyDown={e=>{
   if(e.key==='Escape'){setFocused(false);setActive(-1);}
   if(shown&&e.key==='ArrowDown'){e.preventDefault();setActive(i=>(i+1)%suggestions.length);}
   if(shown&&e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i-1+suggestions.length)%suggestions.length);}
   if(e.key==='Enter'){if(shown&&active>=0&&active<suggestions.length){e.preventDefault();choose(suggestions[active]);}else{setFocused(false);setItems([]);setActive(-1);}}
  }} placeholder={placeholder||(kind==='firms'?'Search law firms and legal organizations':'Lawyer name, bar number, or practice area')}/>
  {enabled&&focused&&loading&&!suggestions.length&&<div className="autocomplete-status" role="status">Finding matching names…</div>}
  {enabled&&focused&&!loading&&failed&&!suggestions.length&&<div className="autocomplete-status" role="status">Suggestions unavailable. Tap Search to try your search.</div>}
  {emptyMessage&&enabled&&focused&&!loading&&!failed&&!suggestions.length&&value.trim().length>=2&&!searchPracticeArea(value)&&<div className="autocomplete-status" role="status">{emptyMessage}</div>}
  {shown&&<ul id="attorney-suggestions" role="listbox" aria-label={kind==='firms'?'Matching firms':practices?'Matching lawyers and practice areas':'Matching lawyers'}>{suggestions.map((item,i)=><li id={'attorney-option-'+i} key={item.kind==='practice'?'practice:'+item.practice.id:item.kind==='firm'?'firm:'+item.firm.firm_key:item.attorney.bar_number} role="option" aria-selected={i===active} onPointerDown={e=>e.preventDefault()} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(item)}>{item.kind==='practice'?<><strong>{item.practice.name}</strong><small>Practice area · {item.practice.description}</small></>:item.kind==='firm'?<><strong>{item.firm.name}</strong><small>Law firm · {item.firm.attorneys} listed {item.firm.attorneys===1?'attorney':'attorneys'}</small></>:<><strong>{item.attorney.name}</strong><small>{[item.attorney.company,item.attorney.city,(item.attorney.state||'GA')].filter(Boolean).join(' · ')}</small></>}</li>)}</ul>}
 </div>;
}
