import {validAttorneyId} from '../attorney-identity';
import SiteHeader from '../SiteHeader';
import ClientAccountGate from './ClientAccountGate';
import type {Metadata} from 'next';
import {SITE_ORIGIN} from '../seo';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Verified Client Reviews of Georgia Lawyers',description:'Read verified client experiences and use a private LawVetter account to review, save, and compare Georgia attorneys.',alternates:{canonical:SITE_ORIGIN+'/client-reviews'}};
export default async function Page({searchParams}:{searchParams:Promise<{bar?:string}>}){const p=await searchParams;return <main><SiteHeader/><ClientAccountGate bar={validAttorneyId(p.bar||'')?p.bar!:''}/></main>;}
