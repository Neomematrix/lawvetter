'use client';
import {useEffect,useState} from 'react';
import {firmReturnTarget} from '../firm-return';
export default function FirmBackLink(){
 const [target,setTarget]=useState({href:'/discover',label:'Back to attorney search'});
 useEffect(()=>{setTarget(firmReturnTarget(window.location.search,document.referrer,window.location.origin));},[]);
 return <a className="firm-back" href={target.href}>{target.label}</a>;
}
