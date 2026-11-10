'use client';
import {useEffect,useRef,useState} from 'react';
export default function AdminCountyField({address,city,state,zip,value,onChange}:{address:string;city:string;state:string;zip:string;value:string;onChange:(county:string)=>void}){
 const [hint,setHint]=useState('County fills automatically from the address and ZIP code.'),[retry,setRetry]=useState(0);
 const key=JSON.stringify([address.trim(),city.trim(),state.trim(),zip.trim()]),previous=useRef(key),first=useRef(true),manual=useRef<string|null>(null),change=useRef(onChange);
 change.current=onChange;
 useEffect(()=>{
  const changed=previous.current!==key;previous.current=key;
  if(changed){manual.current=null;change.current('');}
  if(first.current){first.current=false;if(value.trim()){setHint('Saved county. Updating the address will look it up again.');return;}}
  if(manual.current===key)return;
  if(address.trim().length<4||!/^\d{5}(?:-\d{4})?$/.test(zip.trim())||!/^[A-Z]{2}$/.test(state.trim())){setHint('Enter the street address, state and ZIP code to fill County automatically.');return;}
  const controller=new AbortController();let expired=false,timeout:ReturnType<typeof setTimeout>|undefined;
  const timer=setTimeout(()=>{
   setHint('Finding county…');
   timeout=setTimeout(()=>{expired=true;controller.abort();if(manual.current!==key)setHint('County lookup timed out. Try again or enter the county manually.');},12000);
   fetch('/api/address-county',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:address.trim(),city:city.trim(),state:state.trim(),zip:zip.trim()}),signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();return response.json() as Promise<{county?:string|null}>;}).then(data=>{
    if(controller.signal.aborted||manual.current===key)return;
    if(data.county){change.current(data.county);setHint('County filled from the address. You can correct it.');}else setHint('No exact address match. Enter the county manually.');
   }).catch(()=>{if(!controller.signal.aborted&&!expired&&manual.current!==key)setHint('County lookup is unavailable. Try again or enter the county manually.');}).finally(()=>clearTimeout(timeout));
  },600);
  return()=>{clearTimeout(timer);clearTimeout(timeout);controller.abort();};
 },[address,city,state,zip,key,retry]);
 return <label>County<input name="county" value={value} maxLength={120} aria-describedby="admin-county-hint" onChange={event=>{const county=event.target.value;manual.current=county?key:null;change.current(county);setHint(county?'County entered manually.':'County fills automatically from the address and ZIP code.');if(!county)setRetry(attempt=>attempt+1);}}/><small id="admin-county-hint" role="status">{hint}</small>{/unavailable|timed out|No exact/.test(hint)&&<button type="button" className="admin-county-retry" onClick={()=>{manual.current=null;setRetry(attempt=>attempt+1);}}>Try county lookup again</button>}</label>;
}
