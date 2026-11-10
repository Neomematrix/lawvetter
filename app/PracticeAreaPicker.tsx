 'use client';
import {useEffect,useState} from 'react';
import {categoryList,practiceAreaChoices,splitPracticeAreas,type PracticeCategory} from './practice-category';
export default function PracticeAreaPicker({value,onChange}:{value:string[];onChange:(areas:string[])=>void}){
 const [areas,setAreas]=useState<PracticeCategory[]>(practiceAreaChoices),[other,setOther]=useState(()=>value.filter(name=>!practiceAreaChoices().some(area=>area.name===name)).join(', '));
 useEffect(()=>{const controller=new AbortController();fetch('/api/attorneys?categories=1',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{areas?:PracticeCategory[]}>;}).then(data=>{if(!controller.signal.aborted)setAreas(categoryList([...practiceAreaChoices().map(a=>a.name),...(data.areas||[]).map(a=>a.name)]));}).catch(()=>{});return()=>controller.abort();},[]);
 const names=new Set(areas.map(a=>a.name));
 return <fieldset className="practice-area-picker"><legend>Practice areas *</legend><p>Select every area you practice. Choose at least one so your approved profile appears in the right categories.</p><div className="practice-area-checkboxes">{areas.map(area=><label key={area.id}><input type="checkbox" checked={value.includes(area.name)} onChange={e=>onChange(e.target.checked?[...value,area.name]:value.filter(name=>name!==area.name))}/><span>{area.name}</span></label>)}</div><label className="custom-practice-label">Another practice area (optional)<input value={other} onChange={e=>{setOther(e.target.value);onChange([...value.filter(name=>names.has(name)),...splitPracticeAreas(e.target.value)]);}} maxLength={200} placeholder="Add an area that is not listed"/><small>Separate additional areas with commas.</small></label></fieldset>;
}
