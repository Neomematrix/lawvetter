'use client';
import {useId,useState,type InputHTMLAttributes} from 'react';
export default function PasswordInput(props:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){
 const [visible,setVisible]=useState(false),generatedId=useId(),id=props.id||generatedId;
 return <span className="password-input-wrap"><input {...props} id={id} type={visible?'text':'password'}/><button type="button" className="password-visibility-toggle" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} aria-controls={id} title={visible?'Hide password':'Show password'} disabled={props.disabled} onClick={()=>setVisible(value=>!value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="m3 3 18 18"/>}</svg></button></span>;
}
