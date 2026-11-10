'use client';
import {useId,useRef,useState} from 'react';
import {languageOptions,MAX_LANGUAGES,selectedLanguages} from './languages';
export default function LanguagePicker({value,onChange,disabled=false,name='languages'}:{value:string;onChange:(value:string)=>void;disabled?:boolean;name?:string}){
 const id=useId(),input=useRef<HTMLInputElement>(null),[query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const selected=selectedLanguages(value),options=languageOptions(query).filter(language=>!selected.includes(language)).slice(0,8),visible=open&&selected.length<MAX_LANGUAGES;
 function choose(language:string){if(disabled||selected.length>=MAX_LANGUAGES)return;onChange([...selected,language].join(', '));setQuery('');setActive(-1);setOpen(false);input.current?.focus();}
 return <div className="language-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)){setOpen(false);setActive(-1);}}}>
  <label htmlFor={id}>Languages spoken <span className="language-optional">(optional)</span></label>
  <input type="hidden" name={name} value={selected.join(', ')}/>
  <div className="language-picker-box">
   {selected.map(language=><span className="language-selection" key={language}>{language}<button type="button" disabled={disabled} aria-label={'Remove '+language} onClick={()=>{onChange(selected.filter(item=>item!==language).join(', '));input.current?.focus();}}>×</button></span>)}
   <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible?id+'-options':undefined} aria-activedescendant={visible&&active>=0?id+'-option-'+active:undefined} autoComplete="off" maxLength={80} disabled={disabled||selected.length>=MAX_LANGUAGES} placeholder={selected.length?'Add another language…':'Type a language…'} value={query} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(-1);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(index=>event.key==='ArrowDown'?Math.min(index+1,options.length-1):Math.max(index-1,0));}else if(event.key==='Enter'){event.preventDefault();if(visible&&options.length)choose(options[active>=0?active:0]);}else if(event.key==='Tab')setOpen(false);}}/>
  </div>
  {visible&&<ul id={id+'-options'} className="language-suggestions" role="listbox" aria-label="Suggested languages">{options.map((language,index)=><li key={language} id={id+'-option-'+index} role="option" aria-selected={index===active} onPointerDown={event=>event.preventDefault()}><button type="button" disabled={disabled} onClick={()=>choose(language)}>{language}</button></li>)}{!options.length&&<li role="presentation" className="language-no-matches">No matching languages. Try another spelling.</li>}</ul>}
  <span className="sr-only" aria-live="polite">{selected.length?selected.join(', ')+' selected.':'No languages selected.'}</span>
 </div>;
}
