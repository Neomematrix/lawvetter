export function attorneyChartReturn(search:string,referrer:string,origin:string){
 const requested=new URLSearchParams(search).get('returnTo')||'';
 const candidates=[requested.startsWith('/')&&!requested.startsWith('//')?requested:'',referrer];
 for(const value of candidates){
  if(!value||value.length>4000||/[\\\r\n]/.test(value))continue;
  try{const url=new URL(value,origin);if(url.origin===origin&&url.pathname==='/'&&url.searchParams.get('view')==='charts')return {href:url.pathname+url.search+url.hash,label:url.searchParams.get('chartKind')==='firms'?'Back to firm charts':'Back to attorney charts'};}catch{}
 }
 return {href:'/discover',label:'Find a lawyer'};
}
