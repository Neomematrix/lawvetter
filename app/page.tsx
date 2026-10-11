import type {DiscoveryData} from './Discovery';
import HomeClient from './HomeClient';
import {discoveryData} from './api/attorneys/charts';
import {rawDb} from '../db/raw';
export const dynamic='force-dynamic';
export default async function Home(){
 let initialHome:DiscoveryData|null=null;
 try{initialHome=await discoveryData(rawDb()) as unknown as DiscoveryData;}catch(error){console.error('Initial discovery unavailable',error);}
 return <HomeClient initialHome={initialHome}/>;
}
