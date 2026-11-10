import type {Metadata} from 'next';
import {siteOrigin} from '../../db/site-settings';
import {practiceCatalog} from '../../db/practice-categories';
import {rawDb} from '../../db/raw';
import {practiceAreaChoices} from '../practice-category';
import DiscoverClient from './DiscoverClient';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{return {title:'Discover Lawyers by Practice Area',description:'Find lawyers by name, law firm, city, or practice area. Browse all LawVetter practice areas and compare attorney profiles.',alternates:{canonical:(await siteOrigin())+'/discover'}};}
export default async function Page(){let areas=practiceAreaChoices();try{areas=(await practiceCatalog(rawDb())).areas;}catch(error){console.error('Practice catalog unavailable',error);}return <DiscoverClient areas={areas}/>;}
