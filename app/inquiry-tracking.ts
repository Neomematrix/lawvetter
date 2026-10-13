export function inquiryVisitor(){
 if(typeof window==='undefined'||navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return '';
 try{const key='lawvetter-visitor-'+new Date().toISOString().slice(0,7);let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}catch{return '';}
}
export function trackInquiry(){
 // Fixed event name only: never send form values, attorney names, or contact details.
 if(!inquiryVisitor())return;const w=window as Window&{gtag?:(...args:unknown[])=>void};try{w.gtag?.('event','generate_lead',{event_category:'inquiry',page_location:location.origin,page_title:'LawVetter',page_referrer:''});}catch{}
}
