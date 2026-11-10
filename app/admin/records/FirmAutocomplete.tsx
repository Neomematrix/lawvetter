'use client';
import {useEffect,useState} from 'react';
import LocationAutocomplete from '../../LocationAutocomplete';
type Firm={name:string;website?:string};
export default function FirmAutocomplete({value,onChange,disabled}:{value:string;onChange:(name:string,website:string)=>void;disabled:boolean}){
 const [firms,setFirms]=useState<Firm[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();setFirms([]);setError(false);setLoading(false);if(value.trim().length<2)return;setLoading(true);const timer=setTimeout(()=>{
  fetch('/api/admin/records?'+new URLSearchParams({kind:'firms',q:value.trim()}),{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json() as {records:Firm[]};if(!response.ok)throw Error();if(!controller.signal.aborted)setFirms(data.records.slice(0,12));}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},200);return()=>{clearTimeout(timer);controller.abort();};
 },[value]);
 return <LocationAutocomplete label="Law firm" name="company" value={value} disabled={disabled} onChange={name=>onChange(name,firms.find(firm=>firm.name===name)?.website||'')} options={firms.map(firm=>firm.name)} placeholder="Start typing a law firm name" minLength={0} maxLength={2000} required={false} hint={loading?'Looking for matching firms…':error?'Suggestions are unavailable. You can still enter the firm name.':'Choose an existing firm or enter a new firm name.'}/>;
}
