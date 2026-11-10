'use client';
import {SEARCH_RADII,searchRadius} from '../search-radius';
import {useState,type FormEvent} from 'react';

export default function NearbyZipSearch(){
 const [zip,setZip]=useState(''),[radius,setRadius]=useState(50),[error,setError]=useState('');
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!/^\d{5}$/.test(zip.trim())){setError('Enter a valid 5 digit ZIP code.');return;}
  window.location.assign('/discover?'+new URLSearchParams({zip:zip.trim(),radius:String(radius),status:'active'})+'#attorney-search');
 }
 return <form className="nearby-zip-search" onSubmit={submit} action="/discover" method="get"><label htmlFor="nearby-zip">ZIP code</label><div className="nearby-zip-controls"><input id="nearby-zip" name="zip" type="text" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} required placeholder="Enter ZIP code" value={zip} onChange={event=>{setZip(event.target.value.replace(/\D/g,''));setError('');}} aria-describedby={error?'nearby-zip-error':'nearby-zip-hint'} aria-invalid={!!error}/><label className="nearby-radius">Within<select name="radius" value={radius} onChange={e=>setRadius(searchRadius(e.target.value))}>{SEARCH_RADII.map(miles=><option key={miles} value={miles}>{miles===-1?'Any':miles+' miles'}</option>)}</select></label><input type="hidden" name="status" value="active"/><button className="gold-button" type="submit">Find lawyers</button></div>{error?<p id="nearby-zip-error" role="alert">{error}</p>:<small id="nearby-zip-hint">Search attorneys within your selected distance. Distances are approximate.</small>}</form>;
}
