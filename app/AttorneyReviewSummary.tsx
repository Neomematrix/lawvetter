'use client';
import {useEffect,useState} from 'react';
type Summary={bar_number:string;total:number;average:number|null;excerpt:string};
const cache=new Map<string,{until:number;promise:Promise<Summary|null>}>();
const pending=new Map<string,(value:Summary|null)=>void>();
let timer:ReturnType<typeof setTimeout>|undefined;
function getSummary(bar:string){
 const existing=cache.get(bar);if(existing&&existing.until>Date.now())return existing.promise;
 const promise=new Promise<Summary|null>(resolve=>{pending.set(bar,resolve);if(!timer)timer=setTimeout(flush,0);});cache.set(bar,{until:Date.now()+60000,promise});return promise;
}
async function flush(){
 timer=undefined;const batch=[...pending.entries()].slice(0,50);for(const [bar] of batch)pending.delete(bar);if(pending.size)timer=setTimeout(flush,0);
 try{const r=await fetch('/api/client-reviews?bars='+encodeURIComponent(batch.map(([bar])=>bar).join(',')),{cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json() as {summaries:Summary[]};for(const [bar,resolve] of batch)resolve(data.summaries.find(item=>item.bar_number===bar)||{bar_number:bar,total:0,average:null,excerpt:''});}catch{for(const [bar,resolve] of batch){cache.delete(bar);resolve(null);}}
}
export default function AttorneyReviewSummary({bar,featured=false,comparison=false}:{bar:string;featured?:boolean;comparison?:boolean}){
 const [summary,setSummary]=useState<Summary|null>(null),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let active=true;setSummary(null);setLoaded(false);getSummary(bar).then(value=>{if(active){setSummary(value);setLoaded(true);}});return()=>{active=false;};},[bar]);
 if(comparison){
  if(!loaded)return <span className="comparison-rating-empty" role="status">Loading client ratings…</span>;
  if(!summary)return <span className="comparison-rating-empty">Client ratings unavailable</span>;
  if(!summary.total||summary.average==null)return <span className="comparison-rating-empty">No client ratings yet</span>;
  return <a className="comparison-client-rating" href={'/attorney?bar='+bar+'#client-reviews'}><span className="summary-rating-stars" aria-label={summary.average.toFixed(1)+' out of 5 stars'}><span aria-hidden="true">★★★★★</span><i style={{width:summary.average/5*100+'%'}} aria-hidden="true">★★★★★</i></span><strong>{summary.average.toFixed(1)} <small>/ 5</small></strong><span>{summary.total} verified client {summary.total===1?'review':'reviews'}</span></a>;
 }
 if(!summary?.total||(!featured&&summary.average==null))return null;
 return <a className={'attorney-review-summary'+(featured?' featured-review-summary':'')} href={'/attorney?bar='+bar+'#client-reviews'} aria-label={'Read '+summary.total+' verified client '+(summary.total===1?'review':'reviews')}><div className="attorney-review-summary-score">{summary.average!=null&&<><span className="summary-rating-stars" aria-label={summary.average.toFixed(1)+' out of 5 stars'}><span aria-hidden="true">★★★★★</span><i style={{width:summary.average/5*100+'%'}} aria-hidden="true">★★★★★</i></span>{featured&&<strong>{summary.average.toFixed(1)}<small> / 5</small></strong>}</>}{featured&&<span>{summary.total} verified {summary.total===1?'review':'reviews'}</span>}</div>{featured&&summary.excerpt&&<blockquote>“{summary.excerpt}”</blockquote>}{featured&&<span className="summary-review-link">Read client reviews <span aria-hidden="true">→</span></span>}</a>;
}
