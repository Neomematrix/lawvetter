export const AWARDS_START='2026-10';
export function currentMonth(now=new Date()) {const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(now);return p.find(x=>x.type==='year')!.value+'-'+p.find(x=>x.type==='month')!.value;}
export function validMonth(value:string){return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value)&&value>=AWARDS_START;}
export function nextMonth(value:string){const [y,m]=value.split('-').map(Number);return new Date(Date.UTC(y,m,15)).toISOString().slice(0,7);}
export function monthBoundary(value:string){const [y,m]=value.split('-').map(Number),noon=new Date(Date.UTC(y,m-1,1,4));const z=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(noon).find(p=>p.type==='timeZoneName')!.value;return new Date(Date.UTC(y,m-1,1)-Number(z.replace('GMT',''))*3600000).toISOString();}
export function monthLabel(value:string){return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-15T12:00:00Z'));}
export type Award={month:string;name:string;firm:string;city:string;state:string;profilePath:string;searches:number;finalizedAt:string;methodVersion:1};
export const awardTitle='Lawyer of the Month';
export const awardBasis='Most searched on LawVetter';
export function xml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));}
