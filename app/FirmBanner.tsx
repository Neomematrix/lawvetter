'use client';
import {useState} from 'react';
export default function FirmBanner({name}:{name:string}){
 const [failed,setFailed]=useState(false);
 if(failed||!name)return null;
 const url='/api/enrichment-image?firm='+encodeURIComponent(name);
 return <picture><source media="(max-width: 700px)" srcSet={url+'&size=mobile'}/><img src={url} alt={name+' banner'} onError={()=>setFailed(true)} style={{display:'block',width:'100%',height:'auto',aspectRatio:'1600/533',objectFit:'contain',background:'#fff'}}/></picture>;
}
