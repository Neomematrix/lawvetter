'use client';
import {useState} from 'react';
import Link from 'next/link';
type Role='client'|'attorney'|'firm';
const roles:{id:Role;name:string;description:string}[]=[
 {id:'client',name:'Client',description:'Find legal help, save attorneys and review your requests.'},
 {id:'attorney',name:'Attorney',description:'Manage your professional profile, claims and reviews.'},
 {id:'firm',name:'Law firm',description:'Review your firm listing, attorneys and inquiries.'}
];
const features:Record<Role,{label:string;details:string}[]>={
 client:[{label:'Find an attorney',details:'Search by name, location or practice area.'},{label:'Saved attorneys',details:'Compare attorneys you are considering.'},{label:'Legal help request',details:'Follow the steps for submitting a new inquiry.'},{label:'My reviews',details:'View the process for leaving a verified review.'}],
 attorney:[{label:'My profile',details:'Check how your photo, credentials and biography appear.'},{label:'Practice areas',details:'Check how your specialties display.'},{label:'Reviews',details:'Review ratings and client feedback layout.'},{label:'Profile claims',details:'Examine the claim and verification journey.'}],
 firm:[{label:'Firm profile',details:'Review banner, firm details and contact details.'},{label:'Our attorneys',details:'Check team roster presentation.'},{label:'Legal inquiries',details:'Review how inquiries are presented.'},{label:'Firm details',details:'Inspect listing and editing fields.'}]
};
const destinations:Record<Role,{label:string;href:string}[]>={
 client:[{label:'Browse attorney directory',href:'/discover'},{label:'Open legal help form',href:'/find-legal-help'}],
 attorney:[{label:'Attorney account (normal login)',href:'/account'},{label:'Browse attorney profiles',href:'/discover'}],
 firm:[{label:'Browse firm listings',href:'/discover'},{label:'Open firm page example',href:'/find-a-lawyer'}]
};
export default function ExperiencePreview(){
 const [role,setRole]=useState<Role>('client');
 const [selected,setSelected]=useState(0);
 const [completed,setCompleted]=useState<string[]>([]);
 const current=features[role][selected];
 const key=role+':'+selected;
 function switchRole(next:Role){setRole(next);setSelected(0)}
 return <main className="page-shell account-page" style={{paddingTop:32,paddingBottom:60}}>
  <p className="section-kicker">OWNER TOOLS / EXPERIENCE TESTING</p>
  <Link href="/admin" className="outline-button" style={{display:'inline-block',marginBottom:20}}>Back to admin</Link>
  <h1>View as User</h1>
  <p>Walk through each account type to check the language, layout and navigation. This is a safe demonstration using sample content, not access to a real customer account.</p>
  <section className="lead-card" style={{marginTop:20}}>
   <h2>Choose an experience</h2>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
    {roles.map(r=><button key={r.id} type="button" aria-pressed={role===r.id} onClick={()=>switchRole(r.id)} style={{cursor:'pointer',textAlign:'left',border:role===r.id?'2px solid #ec8a35':'1px solid #74839866',borderRadius:12,padding:16,background:role===r.id?'rgba(235,125,35,.12)':'transparent',color:'inherit'}}>
     <strong>{r.name}</strong><span style={{display:'block',fontSize:13,marginTop:6}}>{r.description}</span>
    </button>)}
   </div>
  </section>
  <section className="lead-card" style={{marginTop:16}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
    <h2 style={{margin:0}}>Example {roles.find(r=>r.id===role)?.name} workspace</h2>
    <span style={{border:'1px solid #d08b50',borderRadius:24,padding:'5px 12px',fontSize:12}}>DEMO ONLY · NO CHANGES SAVED</span>
   </div>
   <p style={{marginTop:12}}>Select a section to inspect its intended user experience and mark it reviewed.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))',gap:16,marginTop:16}}>
    <nav aria-label="Preview account sections" style={{display:'grid',gap:8,alignContent:'start'}}>
     {features[role].map((item,index)=><button key={item.label} type="button" onClick={()=>setSelected(index)} aria-current={selected===index?'page':undefined} style={{textAlign:'left',cursor:'pointer',padding:'12px 14px',borderRadius:10,border:selected===index?'2px solid #dc7b27':'1px solid #74839866',background:selected===index?'rgba(235,125,35,.1)':'transparent',color:'inherit'}}>{completed.includes(role+':'+index)?'✓ ':''}{item.label}</button>)}
    </nav>
    <div style={{border:'1px solid #74839866',borderRadius:14,padding:22,minHeight:230}}>
     <p className="section-kicker">USER VIEW · {role.toUpperCase()}</p>
     <h3>{current.label}</h3>
     <p>{current.details}</p>
     <p style={{fontSize:13}}>Review: Is this easy to find? Is the wording clear on mobile? Is there an obvious next step?</p>
     <button type="button" className="gold-button" onClick={()=>setCompleted(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key])}>{completed.includes(key)?'Mark not reviewed':'Mark reviewed'}</button>
    </div>
   </div>
  </section>
  <section className="lead-card" style={{marginTop:16}}>
   <h2>Test real public pages</h2>
   <p>These links open the existing site. Account-only screens still require the appropriate test account; this demo never overrides authentication.</p>
   <div className="form-actions">{destinations[role].map(d=><Link key={d.href} href={d.href} className="outline-button">{d.label}</Link>)}</div>
  </section>
 </main>;
}
