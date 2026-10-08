import FirmProfile from './FirmProfile';
export default async function FirmPage({searchParams}:{searchParams:Promise<{name?:string|string[]}>}){
 const params=await searchParams;
 const name=typeof params.name==='string'?params.name:'';
 return <main><header className="site-header"><div className="nav-shell"><a className="brand" href="/" aria-label="CounselCheck home"><span className="brand-mark">C</span><span>COUNSEL<span>CHECK</span></span></a><a className="firm-home" href="/">Search attorneys</a></div></header><FirmProfile name={name}/><footer><p>Professional records from the State Bar of Georgia. Firm affiliations reflect the imported directory and may change.</p><a href="/">CounselCheck home</a></footer></main>;
}
