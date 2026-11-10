// Reporting only: stored timestamps and visit deduplication remain unchanged.
export const searchAnalyticsTimezone='America/New_York';
const dateFormat=new Intl.DateTimeFormat('en-US',{timeZone:searchAnalyticsTimezone,year:'numeric',month:'2-digit',day:'2-digit'});
const clockFormat=new Intl.DateTimeFormat('en-US',{timeZone:searchAnalyticsTimezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function easternAnalyticsDay(value:Date|string){
 const parts=dateFormat.formatToParts(new Date(value));
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function easternAnalyticsMidnight(day:string){
 const target=Date.parse(day+'T00:00:00Z');let instant=target;
 for(let i=0;i<3;i++){
  const parts=clockFormat.formatToParts(new Date(instant));
  const part=(type:string)=>Number(parts.find(p=>p.type===type)!.value);
  const local=Date.UTC(part('year'),part('month')-1,part('day'),part('hour'),part('minute'),part('second'));
  instant+=target-local;
 }
 return new Date(instant).toISOString();
}
export function easternAnalyticsBuckets(start:string,end:string){
 const first=easternAnalyticsDay(start),last=easternAnalyticsDay(end),rows=[];
 for(let day=first;day<=last;){
  const next=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  rows.push({day,start:easternAnalyticsMidnight(day),end:easternAnalyticsMidnight(next)});day=next;
 }
 return rows;
}
