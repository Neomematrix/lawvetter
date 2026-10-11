import SingleAttorney from './SingleAttorney';
export default async function Page({searchParams}:{searchParams:Promise<{bar?:string|string[]}>}){const p=await searchParams;return <SingleAttorney bar={typeof p.bar==='string'?p.bar:''}/>;}
