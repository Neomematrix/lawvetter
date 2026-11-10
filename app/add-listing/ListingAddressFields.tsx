'use client';
import {useEffect,useRef,useState} from 'react';
export default function ListingAddressFields({state,city,kind}:{state:string;city:string;kind:'lawyer'|'firm'}){
 const [address,setAddress]=useState(''),[zip,setZip]=useState(''),[county,setCounty]=useState(''),[hint,setHint]=useState('County fills automatically from the street address and ZIP code.');const manual=useRef(false);
 useEffect(()=>{
  if(manual.current)return;
  setCounty('');
  if(address.trim().length<4||!/^\d{5}(?:-\d{4})?$/.test(zip.trim())){setHint('County fills automatically from the street address and ZIP code.');return;}
  const controller=new AbortController(),timer=setTimeout(()=>{setHint('Finding county…');fetch('/api/address-county',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,zip,state,city}),signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();return response.json() as Promise<{county?:string|null}>;}).then(data=>{if(controller.signal.aborted||manual.current)return;if(data.county){setCounty(data.county);setHint('County filled from the address. You can correct it.');}else setHint('No exact address match. Enter the county manually.');}).catch(()=>{if(!controller.signal.aborted&&!manual.current)setHint('County lookup is unavailable. Enter the county manually.');});},600);
  return()=>{clearTimeout(timer);controller.abort();};
 },[address,zip,state,city]);
 return <><div className="listing-form-row"><label>{kind==='firm'?'Firm street address':'Attorney street address'} {kind==='firm'?<span className="required-mark" aria-hidden="true">*</span>:<span>(optional)</span>}<input name="address" required={kind==='firm'} value={address} onChange={e=>setAddress(e.target.value)} maxLength={500} autoComplete="off" placeholder="Street and suite number"/></label><label>ZIP code {kind==='firm'?<span className="required-mark" aria-hidden="true">*</span>:<span>(optional)</span>}<input name="zip" required={kind==='firm'} value={zip} onChange={e=>setZip(e.target.value)} inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10} autoComplete="off"/></label></div><label>County {kind==='firm'?<span className="required-mark" aria-hidden="true">*</span>:<span>(optional)</span>}<input name="county" required={kind==='firm'} value={county} onChange={e=>{manual.current=!!e.target.value;setCounty(e.target.value);setHint(e.target.value?'County entered manually.':'County fills automatically from the street address and ZIP code.');}} maxLength={120}/><small role="status">{hint}</small></label></>;
}
