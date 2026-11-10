'use client';
import {useEffect,useState} from 'react';
import LocationAutocomplete from './LocationAutocomplete';
export default function CityStateAutocomplete(){
 const [value,setValue]=useState(''),[options,setOptions]=useState<string[]>([]);
 useEffect(()=>{setOptions([]);if(value.trim().length<2)return;const controller=new AbortController();let active=true;const timer=setTimeout(async()=>{try{const r=await fetch('/api/cities?format=locations&q='+encodeURIComponent(value.trim()),{signal:controller.signal});if(!r.ok)return;const data=await r.json() as {locations?:{label:string}[]};if(active)setOptions((data.locations||[]).map(location=>location.label));}catch{/* Keep manual entry available if suggestions cannot load. */}},180);return()=>{active=false;clearTimeout(timer);controller.abort();};},[value]);
 return <LocationAutocomplete label="City and state" name="city" value={value} onChange={setValue} options={options} placeholder="Start typing a city, e.g. Atlanta" minLength={2} maxLength={120} hint="Choose a suggestion to fill in both city and state, or enter your city and state."/>;
}
