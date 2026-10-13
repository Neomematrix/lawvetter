import type {Metadata} from 'next';
import type {DiscoveryData} from './Discovery';
import HomeClient from './HomeClient';
import {discoveryData} from './api/attorneys/charts';
import {rawDb} from '../db/raw';
import {SITE_DESCRIPTION,SITE_ORIGIN} from './seo';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Find and Compare Lawyers',description:SITE_DESCRIPTION,alternates:{canonical:SITE_ORIGIN+'/'}};
export default async function Home(){
 let initialHome:DiscoveryData|null=null;
 try{initialHome=await discoveryData(rawDb()) as unknown as DiscoveryData;}catch(error){console.error('Initial discovery unavailable',error);}
 return <HomeClient initialHome={initialHome}/>;
}
