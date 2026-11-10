'use client';
import {useEffect,useState} from 'react';
import LocationAutocomplete from './LocationAutocomplete';

// Use the existing city catalog endpoint, without querying attorney records.
export default function HomepageLocationInput({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [options,setOptions]=useState<string[]>([]),[failed,setFailed]=useState(false);
 useEffect(()=>{
  setOptions([]);setFailed(false);
  if(value.trim().length<2||/^\d/.test(value.trim()))return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{try{
   const response=await fetch('/api/cities?format=locations&q='+encodeURIComponent(value.trim()),{signal:controller.signal});
   if(!response.ok)throw Error('Locations unavailable');
   const data=await response.json() as {locations?:{label:string}[]};
   if(!controller.signal.aborted)setOptions((data.locations||[]).map(location=>location.label));
  }catch{if(!controller.signal.aborted)setFailed(true);}},180);
  return()=>{clearTimeout(timer);controller.abort();};
 },[value]);
 return <LocationAutocomplete restoreFocus label="City or ZIP code" name="location" required={false} value={value} onChange={onChange} options={options} placeholder="City or ZIP code" minLength={0} maxLength={120} pattern={/^\d/.test(value.trim())?'[0-9]{5}(-[0-9]{4})?':undefined} hint={failed?'City suggestions are unavailable. You can still enter a city or ZIP code.':'Choose a city and state, or enter a ZIP code.'}/>;
}
