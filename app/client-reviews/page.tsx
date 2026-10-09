import SiteHeader from '../SiteHeader';
import ClientReviewAccount from './ClientReviewAccount';
import {requireChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
async function SignedIn({bar}:{bar:string}){await requireChatGPTUser('/client-reviews'+(bar?'?bar='+encodeURIComponent(bar):''));return <ClientReviewAccount bar={bar}/>;}
export default async function Page({searchParams}:{searchParams:Promise<{bar?:string}>}){const p=await searchParams;return <main><SiteHeader/><SignedIn bar={/^\d{1,20}$/.test(p.bar||'')?p.bar!:''}/></main>;}
