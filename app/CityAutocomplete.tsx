'use client';
import {useEffect,useState} from 'react';
import LocationAutocomplete from './LocationAutocomplete';
export default function CityAutocomplete({state,value,onChange,required=false}:{state?:string;value:string;onChange:(v:string)=>void;required?:boolean}){
 const [options,setOptions]=useState<string[]>([]),[failed,setFailed]=useState(false);
 useEffect(()=>{const controller=new AbortController();setOptions([]);setFailed(false);const timer=setTimeout(()=>{const params=new URLSearchParams({q:value,...(state?{state}:{})});fetch('/api/cities?'+params,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json() as {cities:string[]};setOptions(data.cities);}).catch(e=>{if(e.name!=='AbortError')setFailed(true);});},200);return()=>{clearTimeout(timer);controller.abort();};},[state,value]);
 return <LocationAutocomplete label="City" name="city" required={required} value={value} onChange={onChange} options={options} placeholder="Start typing a city" minLength={0} maxLength={120} hint={failed?'Suggestions are unavailable. You can enter the city.':'Choose a suggestion or enter another city.'}/>;
}
