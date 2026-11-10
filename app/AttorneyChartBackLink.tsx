'use client';
import {useEffect,useState} from 'react';
import {attorneyChartReturn} from './attorney-chart-return';
export default function AttorneyChartBackLink(){
 const [target,setTarget]=useState({href:'/discover',label:'Find a lawyer'});
 useEffect(()=>{setTarget(attorneyChartReturn(window.location.search,document.referrer,window.location.origin));},[]);
 return <a href={target.href}>{target.label}</a>;
}
