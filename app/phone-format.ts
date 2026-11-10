import type {ChangeEvent} from 'react';

export function formatPhoneInput(value:string){
 const trimmed=value.trim();
 // Preserve international numbers and unsupported text for existing validation.
 if(trimmed.startsWith('+')&&!/^\+1(?:\D|\d)/.test(trimmed))return value;
 if(/[^\d\s+().-]/.test(value))return value;
 let digits=value.replace(/\D/g,'');
 const country=trimmed.startsWith('+1');
 if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);
 else if(country)digits=digits.slice(1);
 if(digits.length>10)return value;
 const formatted=digits.length<=3?digits:digits.length<=6?digits.slice(0,3)+'-'+digits.slice(3):digits.slice(0,3)+'-'+digits.slice(3,6)+'-'+digits.slice(6);
 return country?'+1'+(formatted?'-'+formatted:''):formatted;
}

export function formatPhoneEvent(event:ChangeEvent<HTMLInputElement>){
 const input=event.currentTarget,original=input.value,start=input.selectionStart;
 const formatted=formatPhoneInput(original);if(formatted===original)return;
 const digitsBefore=start===null?null:original.slice(0,start).replace(/\D/g,'').length;
 input.value=formatted;
 if(digitsBefore!==null){let position=0,count=0;while(position<formatted.length&&count<digitsBefore){if(/\d/.test(formatted[position]))count++;position++;}input.setSelectionRange(position,position);}
}
