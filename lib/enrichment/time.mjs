const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
export function easternParts(date=new Date()) {return Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
export function nightlyKey(date=new Date()) {const p=easternParts(date);return p.hour==='00'?`${p.year}-${p.month}-${p.day}`:null;}
export function nextScan(date=new Date()) {let t=new Date(date).getTime();t=Math.floor(t/3600000)*3600000+3600000;for(let i=0;i<27;i++,t+=3600000)if(nightlyKey(new Date(t)))return new Date(t).toISOString();throw Error('Unable to compute next scan');}
