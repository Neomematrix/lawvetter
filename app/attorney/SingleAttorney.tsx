'use client';
import SiteHeader from '../SiteHeader';

import {useEffect,useState} from 'react';
import type {Attorney} from '../GeorgiaDirectory';
import AttorneyProfile from '../AttorneyProfile';
import {requestAttorneyData} from '../attorney-request';
import {ShortlistNotice} from '../Shortlist';
export default function SingleAttorney({bar}:{bar:string}){const [a,setA]=useState<Attorney|null>(null),[error,setError]=useState('');useEffect(()=>{requestAttorneyData<{attorney:Attorney}>({id:bar}).then(x=>setA(x.attorney)).catch(e=>setError(e.message));},[bar]);return <main><SiteHeader/><div className="page-shell"><a href="/">Back to discovery</a><ShortlistNotice/>{error?<p className="directory-error" role="alert">{error}</p>:a?<AttorneyProfile attorney={a}/>:<p role="status">Loading attorney profile…</p>}</div></main>;}
