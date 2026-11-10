export function recordDirectoryVisit(kind:'firm'|'attorney',target:string){
 if(navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return;
 const old=window.history.state||{},key=kind+':'+target,eventId=old.directoryVisitTarget===key&&old.directoryVisitEvent?old.directoryVisitEvent:crypto.randomUUID();window.history.replaceState({...old,directoryVisitTarget:key,directoryVisitEvent:eventId},'',window.location.href);
 void fetch('/api/directory-views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,target,eventId,referrer:document.referrer})}).catch(()=>{});
}
