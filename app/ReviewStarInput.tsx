'use client';
import {useId} from 'react';
export default function ReviewStarInput({label,value,onChange}:{label:string;value:number|null;onChange:(value:number)=>void}){
 const id=useId();
 return <fieldset className="review-star-input"><legend>{label}</legend><div>{[1,2,3,4,5].map(star=><label key={star}><input type="radio" name={id} required value={star} checked={value===star} onChange={()=>onChange(star)}/><span aria-hidden="true" className={value&&star<=value?'filled':''}>★</span><span className="sr-only">{star} {star===1?'star':'stars'}</span></label>)}</div><small>{value?value+' / 5':'Select 1–5 stars'}</small></fieldset>;
}
