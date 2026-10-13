'use client';
import AttorneyNameInput from './AttorneyNameInput';
import SearchAdvertisement,{activeSearchSponsor} from './SearchAdvertisement';
import {FormEvent,useEffect,useState} from 'react';
import {practiceAreas,practiceCoverage,practiceSourceUrl,searchPracticeArea} from './practice-areas';
import AttorneyProfile from './AttorneyProfile';
import {FirmLink} from './FirmLink';
import {ShortlistNotice} from './Shortlist';
import {AttorneyCard,Charts,DiscoveryHome,ShortlistPage,type DiscoveryData,type View} from './Discovery';
import {requestAttorneyData} from './attorney-request';
import LandingHero from './LandingHero';

export type Attorney={state?:string;license_number?:string;bar_number:string;name:string;company:string;city:string;county:string;status:string;admit_date:string;imported_at:string;law_school?:string;address?:string;zip?:string;phone?:string;email?:string;photo_key?:string;source_url?:string};
type Results={attorneys?:Attorney[];firms?:{name:string;firm_key:string;attorneys:number}[];total:number;page:number;updated?:string};

export default function GeorgiaDirectory({view='discover',onView,initialHome=null}:{view?:View;onView:(v:View)=>void;initialHome?:DiscoveryData|null}){
 const [name,setName]=useState(''),[city,setCity]=useState('');
 const [query,setQuery]=useState({q:'',city:'',practice:'',statusGroup:'active',kind:'attorneys',page:1,eventId:''}),[searched,setSearched]=useState(false);
 const [home,setHome]=useState<DiscoveryData|null>(initialHome),[homeLoading,setHomeLoading]=useState(!initialHome),[result,setResult]=useState<Results|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState<Attorney|null>(null),[detailLoading,setDetailLoading]=useState(false);
 async function loadHome(){setHomeLoading(true);setError('');try{setHome(await requestAttorneyData<DiscoveryData>({home:'1'}));}catch(e){setError(e instanceof Error?e.message:'Unable to load discovery.');}finally{setHomeLoading(false);}}
 useEffect(()=>{if(!initialHome)loadHome();},[]);
 useEffect(()=>{setSelected(null);setSearched(false);setError('');},[view]);
 useEffect(()=>{if(!searched)return;const controller=new AbortController();setLoading(true);setError('');requestAttorneyData<Results>(query,controller.signal).then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[query,searched]);
 function search(e:FormEvent){e.preventDefault();if(!name.trim()&&!city.trim()){setError('Enter a name, firm, bar number, city, state, or practice area.');return;}setSelected(null);setSearched(true);const area=searchPracticeArea(name);setQuery({q:area?'':name.trim(),city:city.trim(),practice:area?.id||'',statusGroup:'active',kind:'attorneys',page:1,eventId:crypto.randomUUID()});}
 function browsePractice(practice:string){setCity('');setName(practiceAreas.find(a=>a.id===practice)?.name||'');setSelected(null);setSearched(true);setQuery({q:'',city:'',practice,statusGroup:'active',kind:'attorneys',page:1,eventId:''});document.getElementById('attorney-search')?.scrollIntoView({behavior:'smooth'});}
 async function open(a:Attorney,fromSearch=false){setSelected(a);setDetailLoading(true);setError('');try{const x=await requestAttorneyData<{attorney:Attorney}>({id:a.bar_number,...(fromSearch?{...query,kind:'attorneys'}:{})});setSelected(x.attorney);}catch(e){setError(e instanceof Error?e.message:'Unable to open this record.');}finally{setDetailLoading(false);}}
 return <>
  {view==='discover'&&!searched&&!selected&&<LandingHero/>}
  <section className="discovery-search" id="attorney-search" aria-label="Attorney and firm search"><form onSubmit={search}>
   <div className="primary-search"><AttorneyNameInput value={name} city={city} enabled onChange={setName} onSelect={a=>{setName(a.name);setSelected(null);setSearched(true);setQuery({q:a.bar_number,city:city.trim(),practice:'',statusGroup:'active',kind:'attorneys',page:1,eventId:crypto.randomUUID()});}}/></div>
   <label className="search-city"><span>City or State</span><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Any City or State"/></label><button className="gold-button search-submit" type="submit" aria-label="Search">Search</button>
  </form></section>
  <div className="page-shell discovery-shell"><ShortlistNotice/>
   {error&&<div className="directory-error" role="alert">{error} <button onClick={()=>selected?open(selected):searched?setQuery({...query}):loadHome()}>Try again</button> <a href="/" target="_top">Reopen LawVetter</a></div>}
   {selected?<><button className="outline-button" onClick={()=>setSelected(null)}>Back to {searched?'results':view==='shortlist'?'shortlist':view==='charts'?'charts':'discovery'}</button><AttorneyProfile attorney={selected} loading={detailLoading}/></>
   :searched?<section className="search-results">
    <div className="section-heading"><div><p className="section-kicker">{query.kind==='firms'?'FIRM':'ATTORNEY'} SEARCH</p><h1>{loading?'Searching…':`${(result?.total||0).toLocaleString()} results`}</h1></div><div className="directory-grow-actions"><a className="outline-button" href="/add-listing?type=lawyer">+ Add lawyer</a><a className="outline-button" href="/add-listing?type=firm">+ Add firm</a><button className="text-action" onClick={()=>{setSearched(false);loadHome();}}>Back to discovery</button></div></div>
    <p className="section-description">{query.practice&&practiceAreas.find(a=>a.id===query.practice)?.name}{query.q&&`“${query.q}”`}{query.city&&` · ${query.city}`}{query.kind==='attorneys'&&` · ${query.statusGroup==='active'?'Active':'Not active'}`}</p>
    {query.practice&&<p className="record-note">{practiceCoverage}</p>}
    {query.kind==='attorneys'&&<div className="results-status-toggle segmented" aria-label="Filter attorneys by activity"><button aria-pressed={query.statusGroup==='active'} onClick={()=>setQuery({...query,statusGroup:'active',page:1})}>Active</button><button aria-pressed={query.statusGroup==='not-active'} onClick={()=>setQuery({...query,statusGroup:'not-active',page:1})}>Not active</button></div>}
    {query.kind==='attorneys'&&query.statusGroup==='not-active'&&<p className="record-note">Includes inactive, suspended, deceased, resigned, and other statuses. Each record shows the exact State Bar status.</p>}
    <div className={activeSearchSponsor()?"search-results-layout":"search-results-without-ad"}><div className="search-results-main">
    {loading?<p role="status">Loading matching records…</p>:result?.total?<>{query.kind==='firms'
     ?<div className="firm-ranking-grid">{result.firms?.map(f=><article className="firm-result-card" key={f.firm_key}><span className="section-kicker">FIRM / ORGANIZATION</span><h2><FirmLink name={f.name} eventId={query.eventId}/></h2><p>{f.attorneys.toLocaleString()} listed attorneys{query.city?' matching this city':''}</p></article>)}</div>
     :<div className="results-card-grid">{result.attorneys?.map(a=><div key={a.bar_number}><AttorneyCard attorney={a} onOpen={a=>open(a,true)}/>{query.practice&&<p className="practice-source">{practiceSourceUrl(a.bar_number,query.practice)?<a href={practiceSourceUrl(a.bar_number,query.practice)} target="_blank" rel="noopener noreferrer">Published practice information ↗</a>:'Practice information supplied by profile owner'}</p>}</div>)}</div>}
     <div className="directory-pagination"><button className="outline-button" disabled={query.page<=1} onClick={()=>setQuery({...query,page:query.page-1})}>Previous</button><span>Page {query.page} of {Math.ceil(result.total/25).toLocaleString()}</span><button className="outline-button" disabled={query.page*25>=result.total} onClick={()=>setQuery({...query,page:query.page+1})}>Next</button></div>
    </>:!error&&<div className="chart-empty"><div><h2>No matches yet.</h2><p>Try another search, or use Add lawyer or Add firm above to suggest the missing listing.</p></div></div>}
    </div><SearchAdvertisement/></div>
   </section>
   :view==='shortlist'?<ShortlistPage onOpen={open}/>
   :homeLoading?<div className="discovery-loading" role="status"><span/><p>Loading LawVetter discovery…</p></div>
   :home?view==='charts'?<Charts data={home} onOpen={open}/>:<DiscoveryHome data={home} onOpen={open} onPractice={browsePractice} onView={onView}/>:null}
  </div>
 </>;
}
