import SiteHeader from '../SiteHeader';
import ClientAccountGate from './ClientAccountGate';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{bar?:string}>}){const p=await searchParams;return <main><SiteHeader/><ClientAccountGate bar={/^\d{1,20}$/.test(p.bar||'')?p.bar!:''}/></main>;}
