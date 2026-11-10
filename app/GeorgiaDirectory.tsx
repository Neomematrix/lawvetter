'use client';
import {SEARCH_RADII,searchRadius} from './search-radius';
import {DIRECTORY_PAGE_SIZE} from './directory-page-size';
import AttorneyNameInput from './AttorneyNameInput';
import SearchAdvertisement,{activeSearchSponsor} from './SearchAdvertisement';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {practiceAreas,searchPracticeArea} from './practice-catalog';
import {directoryLocation,directorySearchPath,type DirectoryQuery} from './directory-navigation';
import {attorneyPath} from './seo';
import {FirmLink} from './FirmLink';
import FirmLogo from './FirmLogo';
import {ShortlistNotice} from './Shortlist';
import {AttorneyCard} from './AttorneyCard';
import SingleAttorneyResult from './SingleAttorneyResult';
import type {DiscoveryData,View} from './Discovery';
import {Suspense,lazy} from 'react';
import DirectoryContent,{type DirectoryViewComponent,type InitialDiscoveryData} from './DirectoryContent';
import {requestAttorneyData} from './attorney-request';
import LandingHero from './LandingHero';
import HeroSpotlightState from './HeroSpotlightState';
import type {HeroSpotlightComponent} from './HeroMonthlySpotlight';
import HomepageLocationInput from './HomepageLocationInput';
import PracticeAreaGrid from './PracticeAreaGrid';
import {practiceAreaChoices,type PracticeCategory} from './practice-category';

export type Attorney={languages?:string|null;employment_type?:string;employer_name?:string;employer_website?:string;biography_website?:string;firm_website?:string;attorney_linkedin?:string;firm_linkedin?:string;published_details?:ReturnType<typeof import('./published-attorney-details').publishedAttorneyDetails>;public_id?:string|null;ownership_verified?:number;owner_edited?:number;practice_areas?:string;state?:string;license_number?:string;bar_number:string;name:string;company:string;city:string;county:string;status:string;admit_date:string;imported_at:string;law_school?:string;address?:string;zip?:string;phone?:string;email?:string;photo_key?:string;source_url?:string};
const DeferredHeroSpotlight=lazy(()=>import('./HeroMonthlySpotlight'));

type Results={attorneys?:Attorney[];suggestions?:Attorney[];firms?:{name:string;firm_key:string;attorneys:number}[];total:number;paginationTotal?:number;page:number;updated?:string};

export default function GeorgiaDirectory({view='discover',onView,initialHome=null,initialContent,initialContentView=view,discoveryPage=false,practiceCategories,initialHero}:{view?:View;onView:(v:View)=>void;initialHome?:InitialDiscoveryData;initialContent?:DirectoryViewComponent;initialContentView?:View;discoveryPage?:boolean;practiceCategories?:PracticeCategory[];initialHero?:HeroSpotlightComponent}){
 const [mobileSearch,setMobileSearch]=useState(false);
 const [searchPractices,setSearchPractices]=useState<PracticeCategory[]>(practiceAreaChoices);
 useEffect(()=>{const media=window.matchMedia('(max-width:700px)'),sync=()=>setMobileSearch(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 const resultsRef=useRef<HTMLElement>(null),scrollPending=useRef(false),heroFormRef=useRef<HTMLFormElement>(null);
 const [searchKind,setSearchKind]=useState<'attorneys'|'firms'>('attorneys');
 const [name,setName]=useState(''),[city,setCity]=useState(''),[zip,setZip]=useState(''),[radius,setRadius]=useState(50);
 const [query,setQuery]=useState<DirectoryQuery>({q:'',city:'',practice:'',statusGroup:'active',kind:'attorneys',page:1,eventId:''}),[searched,setSearched]=useState(false);
 const [home,setHome]=useState<DiscoveryData|null>(initialHome&&!('then' in initialHome)?initialHome:null),[result,setResult]=useState<Results|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function loadHome(){setError('');try{setHome(await requestAttorneyData<DiscoveryData>({home:'1'}));}catch(e){setError(e instanceof Error?e.message:'Unable to load discovery.');}}
 useEffect(()=>{if(discoveryPage)return;let cancelled=false,timer:ReturnType<typeof setTimeout>;Promise.resolve(initialHome).then(data=>{if(data?.practiceCategories&&!cancelled)setSearchPractices(data.practiceCategories);if(!data&&!cancelled)timer=setTimeout(()=>{if(!cancelled)void loadHome();},5000);});return()=>{cancelled=true;clearTimeout(timer);};},[]);
 useEffect(()=>{setSearched(false);setError('');},[view]);
 useEffect(()=>{let firstSync=true;const sync=()=>{const current=directoryLocation(window.location.search,window.history.state?.directoryEventId||'');const earlyForm=firstSync&&!current.searched&&!discoveryPage?heroFormRef.current:null,earlyName=earlyForm?.querySelector<HTMLInputElement>('#attorney-name-input')?.value||'',earlyLocation=earlyForm?.querySelector<HTMLInputElement>('[name=location]')?.value||'',earlyZip=/^\d/.test(earlyLocation.trim());firstSync=false;setName(current.query.q||practiceAreas.find(a=>a.id===current.query.practice)?.name||earlyName);setCity(current.query.city||(!earlyZip?earlyLocation:''));setZip(current.query.zip||(earlyZip?earlyLocation:''));setRadius(searchRadius(current.query.radius));setQuery(current.query);setSearchKind(current.query.kind==='firms'?'firms':'attorneys');setSearched(current.searched);setError('');};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[view]);
 useEffect(()=>{if(!loading&&!error&&scrollPending.current){scrollPending.current=false;resultsRef.current?.scrollIntoView?.({block:'start',behavior:'instant'});}},[loading,result,error]);
 const HeroSpotlight=initialHero||DeferredHeroSpotlight;
 const showLanding=view==='discover'&&!searched&&!discoveryPage;
 function submitSearch(next:DirectoryQuery){if(showLanding){window.location.assign(directorySearchPath('discover',next,'/discover'));return;}commitQuery(next);}
 function selectAttorney(a:Attorney){
  // Record the selected result without delaying navigation or running a name search.
  void fetch('/api/attorneys',{method:'POST',credentials:'include',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.bar_number,q:a.bar_number,kind:'attorneys',eventId:crypto.randomUUID()})}).catch(()=>{});
  window.location.assign(attorneyPath(a));
 }
 function commitQuery(next:DirectoryQuery){scrollPending.current=true;setLoading(true);setResult(null);setSearched(true);setQuery(next);window.history.pushState({...window.history.state,directoryEventId:next.eventId},'',directorySearchPath(view,next,discoveryPage?'/discover':'/'));}
 useEffect(()=>{if(!searched)return;const controller=new AbortController();setLoading(true);setResult(null);setError('');requestAttorneyData<Results>(query,controller.signal).then(data=>{if(controller.signal.aborted)return;setResult(data);window.dispatchEvent(new CustomEvent('lawvetter:search-results',{detail:{term:query.q||query.practice,kind:query.kind,city:query.city,total:data.total,page:query.page}}));}).catch(e=>{if(!controller.signal.aborted&&e.name!=='AbortError'){setResult(null);setError(e.message);};}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[query,searched]);
 function search(e:FormEvent){e.preventDefault();e.currentTarget.querySelector('input')?.blur();if(!name.trim()&&!city.trim()&&!zip.trim()){setError('Enter a name, firm, bar number, city, state, ZIP code, or practice area.');return;}const area=searchKind==='attorneys'?searchPracticeArea(name):undefined;submitSearch({...(zip.trim()?{zip:zip.trim(),radius}:{}),q:area?'':name.trim(),city:city.trim(),practice:area?.id||'',statusGroup:'active',kind:searchKind,page:1,eventId:crypto.randomUUID()});}
 function browsePractice(practice:string){setSearchKind('attorneys');setCity('');setName(practiceAreas.find(a=>a.id===practice)?.name||'');setSearched(true);commitQuery({...(zip.trim()?{zip:zip.trim(),radius}:{}),q:'',city:'',practice,statusGroup:'active',kind:'attorneys',page:1,eventId:''});window.scrollTo({top:0,left:0,behavior:'instant'});}
 async function open(a:Attorney,fromSearch=false){setError('');try{const x=await requestAttorneyData<{attorney:Attorney}>({id:a.bar_number,...(fromSearch?{...query,kind:'attorneys'}:{})});const source=window.location.search,returnTo=new URLSearchParams(source).get('view')==='charts'?(attorneyPath(x.attorney).includes('?')?'&':'?')+'returnTo='+encodeURIComponent((window.location.pathname||'/')+source):'';window.location.assign(attorneyPath(x.attorney)+returnTo);}catch(e){setError(e instanceof Error?e.message:'Unable to open this record.');}}
 return <>
  {showLanding&&<LandingHero spotlight={<Suspense fallback={<HeroSpotlightState loading/>}><HeroSpotlight initialData={initialHome} data={home} onData={setHome} onOpen={open}/></Suspense>} search={<form ref={heroFormRef} className="landing-attorney-search" id="attorney-search" role="search" aria-label="Find an attorney" onSubmit={search}>
   <div className="landing-search-name"><svg className="landing-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><div className="landing-field-content"><span className="landing-search-label" aria-hidden="true">Attorney name or practice area</span><AttorneyNameInput value={name} city={city} enabled onChange={setName} onSelect={selectAttorney} label="Attorney name or practice area" placeholder="Name or practice area" practices={searchPractices} restoreFocus emptyMessage="No matching attorneys or practice areas. Try another name or legal need."/></div></div>
   <div className="landing-search-location"><svg className="landing-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><HomepageLocationInput value={zip||city} onChange={value=>{if(/^\d/.test(value.trim())){setZip(value);setCity('');}else{setCity(value);setZip('');}}}/></div>
   <button className="landing-search-submit" type="submit">Search</button>
   {error&&<p className="landing-search-error" role="alert">{error}</p>}
  </form>}/>}
  {!showLanding&&<section className={'discovery-search'+(view==='shortlist'?' shortlist-search':'')} id="attorney-search" aria-label="Attorney and firm search"><div className="directory-kind-toggle" role="group" aria-label="Search category">{(['attorneys','firms'] as const).map(kind=><button key={kind} type="button" aria-pressed={searchKind===kind} onClick={()=>{setSearchKind(kind);if(searched&&query.kind!==kind)commitQuery({...query,kind,q:query.q||name.trim(),practice:kind==='firms'?'':query.practice,page:1,eventId:crypto.randomUUID()});}}>{kind==='attorneys'?'Lawyers':'Firms'}</button>)}</div><form onSubmit={search}>
   <div className="primary-search"><AttorneyNameInput kind={searchKind} onSelectFirm={firm=>window.location.assign('/firm?name='+encodeURIComponent(firm.name)+'&search='+crypto.randomUUID())} value={name} city={city} enabled onChange={setName} onSelect={selectAttorney}/></div>
   <label className="search-city"><span>City or State</span><input name="city" value={city} onChange={e=>setCity(e.target.value)} placeholder="Any City or State"/></label><label className="search-zip"><span className="sr-only">ZIP code</span><input name="zip" aria-label="ZIP code" value={zip} onChange={e=>setZip(e.target.value)} placeholder="ZIP code" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10}/></label><label className="search-within"><span className="sr-only">Within</span><select name="radius" aria-label="Within distance" value={radius} disabled={!zip.trim()} onChange={e=>setRadius(searchRadius(e.target.value))}>{SEARCH_RADII.map(miles=><option key={miles} value={miles}>{miles===-1?'Any':miles+' miles'}</option>)}</select></label><button className="gold-button search-submit" type="submit" aria-label="Search">Search</button>
  </form></section>}
  <div className={'page-shell discovery-shell'+(view==='shortlist'?' shortlist-shell':'')}><ShortlistNotice/>
   {error&&!showLanding&&<div className="directory-error" role="alert">{error} <button onClick={()=>searched?setQuery({...query}):loadHome()}>Try again</button> <a href="/" target="_top">Reopen LawVetter</a></div>}
   
   {searched?<section ref={resultsRef} className={'search-results'+(mobileSearch&&!loading&&query.kind!=='firms'&&result?.total===1&&result.attorneys?.length===1?' single-match-results':'')}>
    <div className="section-heading"><div><p className="section-kicker">{query.kind==='firms'?'FIRM':'LAWYER'} SEARCH</p><h1 className="search-result-count">{loading?'Searching…':error?'Search unavailable':`${(result?.total||0).toLocaleString()} ${query.kind==='firms'?(result?.total===1?'firm':'firms'):(result?.total===1?'attorney':'attorneys')} found`}</h1></div><div className="directory-grow-actions"><a className="outline-button" href="/add-listing?type=lawyer">+ Add lawyer</a><a className="outline-button" href="/add-listing?type=firm">+ Add firm</a><button className="text-action" onClick={()=>onView('discover')}>Back to discovery</button></div></div>
    {query.zip&&<div className="search-radius-controls"><label>Within<select name="resultsRadius" value={searchRadius(query.radius)} onChange={e=>{const miles=searchRadius(e.target.value);setRadius(miles);commitQuery({...query,radius:miles,page:1});}}>{SEARCH_RADII.map(miles=><option key={miles} value={miles}>{miles===-1?'Any':miles+' miles'}</option>)}</select></label><button className="text-action" onClick={()=>{setZip('');setRadius(50);commitQuery({...query,zip:'',radius:50,page:1});}}>Clear ZIP code</button><small className="zip-distance-note">Approximate straight line distances between ZIP locations. Location data: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>.</small></div>}
    <div className={activeSearchSponsor()?"search-results-layout":"search-results-without-ad"}><div className="search-results-main">
    {loading?<p role="status">Loading matching records…</p>:result?.total?<>{query.kind==='firms'&&!!result.firms?.length&&<div className="firm-ranking-grid">{result.firms?.map(f=><article className="firm-result-card" key={f.firm_key}><FirmLink name={f.name} eventId={query.eventId}><FirmLogo banner fallbackName name={f.name}/></FirmLink><p>{f.attorneys.toLocaleString()} listed {f.attorneys===1?'attorney':'attorneys'}{query.city?' matching this city':''}</p></article>)}</div>}
     {query.kind!=='firms'&&(mobileSearch&&result.total===1&&result.attorneys?.length===1?<SingleAttorneyResult key={result.attorneys[0].bar_number} attorney={result.attorneys[0]}/>:<div className="results-card-grid">{result.attorneys?.map(a=><AttorneyCard showFullName showLanguages key={a.bar_number} attorney={a} onOpen={a=>open(a,true)}/>)}</div>)}
     {(result.paginationTotal??result.total)>DIRECTORY_PAGE_SIZE&&<div className="directory-pagination"><button className="outline-button" disabled={query.page<=1} onClick={()=>commitQuery({...query,page:query.page-1})}>Previous</button><span>Page {query.page} of {Math.ceil((result.paginationTotal??result.total)/DIRECTORY_PAGE_SIZE).toLocaleString()}</span><button className="outline-button" disabled={query.page*DIRECTORY_PAGE_SIZE>=(result.paginationTotal??result.total)} onClick={()=>commitQuery({...query,page:query.page+1})}>Next</button></div>}
    </>:!error&&<div className="chart-empty"><div><h2>No matches yet.</h2>{result?.suggestions?.length?<><p>Did you mean one of these attorneys? You can search with just their first and last names.</p><div className="name-search-suggestions">{result.suggestions.map(a=><a key={a.bar_number} href={'/?q='+encodeURIComponent(a.name)} onClick={event=>{event.preventDefault();setName(a.name);commitQuery({...query,q:a.name,page:1,eventId:crypto.randomUUID()});}}><strong>{a.name}</strong><span>{a.city||'City not listed'}, {a.state||'GA'}</span></a>)}</div></>:<p>Search with the attorney’s first and last names. Check the spelling, or use Add lawyer to suggest a missing listing.</p>}</div></div>}
    </div><SearchAdvertisement/></div>
   </section>
   :discoveryPage?<PracticeAreaGrid areas={practiceCategories||practiceAreaChoices()}/>
   :<Suspense fallback={view==='discover'?<DirectoryContent view={view} initialView={initialContentView} initialComponent={initialContent} data={null} pending onOpen={open} onPractice={browsePractice} onView={onView}/>:<div className="discovery-loading" role="status"><span/><p>Loading LawVetter discovery…</p></div>}>
    <DirectoryContent view={view} initialView={initialContentView} initialComponent={initialContent} data={home||initialHome} onOpen={open} onPractice={browsePractice} onView={onView}/>
   </Suspense>}
  </div>
 </>;
}
