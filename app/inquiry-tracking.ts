export function inquiryVisitor(){
 if(typeof window==='undefined'||navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return '';
 try{const key='lawvetter-visitor-'+new Date().toISOString().slice(0,7);let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}catch{return '';}
}
// Keep submission identifiers in this browser only; never send them to GA.
const trackedInquiries=new Set<string>();
export function trackInquiry(submissionId:string){
 if(typeof window==='undefined'||navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId))return;
 const w=window as Window&{gtag?:(...args:unknown[])=>void};
 if(typeof w.gtag!=='function'||trackedInquiries.has(submissionId))return;
 const key='lawvetter-ga-lead-'+submissionId;
 try{if(localStorage.getItem(key))return;}catch{}
 // Mark before dispatch to guard repeated callbacks, including reentrant ones.
 trackedInquiries.add(submissionId);
 try{localStorage.setItem(key,'1');}catch{}
 // Fixed, allowlisted values only: no form fields, inquiry IDs, or URL queries.
 try{w.gtag('event','generate_lead',{event_category:'inquiry',page_location:location.origin,page_title:'LawVetter',page_referrer:''});}catch{}
}
