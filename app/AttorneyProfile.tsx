import type { Attorney } from './GeorgiaDirectory';
import { FirmLink } from './FirmLink';
export default function AttorneyProfile({attorney,loading=false}:{attorney:Attorney;loading?:boolean}){
 const date=(s:string)=>s?new Date(s).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}):'Not listed';
 return (    <article className="profile-card directory-detail" aria-busy={loading}>
     <div className="profile-heading"><div className="portrait"><span>{attorney.name.split(' ').filter(Boolean).map(n=>n[0]).slice(0,2).join('')}</span></div><div className="identity"><p className="section-kicker">Georgia Bar #{attorney.bar_number}</p><h2>{attorney.name}</h2>{attorney.company&&<p className="role"><FirmLink name={attorney.company}/></p>}<p className="location">{attorney.city || 'City not listed'}, Georgia</p><p className="directory-status">{attorney.status}</p></div></div>
     {loading?<p role="status">Loading attorney record…</p>:<div className="profile-body">
      <section className="credentials"><h3>Professional record</h3><dl><div><dt>Bar number</dt><dd>GA #{attorney.bar_number}</dd></div><div><dt>Membership status</dt><dd>{attorney.status}</dd></div><div><dt>Admitted</dt><dd>{date(attorney.admit_date)}</dd></div><div><dt>Law school</dt><dd>{attorney.law_school||'Not listed'}</dd></div><div><dt>County</dt><dd>{attorney.county||'Not listed'}</dd></div></dl><p className="record-note">Imported from the State Bar directory on {date(attorney.imported_at)}. Status may change after this date.</p><a href={attorney.source_url} target="_blank" rel="noreferrer">View official bar record</a></section>
      <section><h3>Public contact information</h3>{attorney.address&&<address>{attorney.address}<br/>{attorney.city}, GA {attorney.zip}</address>}{attorney.phone&&<p><a href={'tel:'+attorney.phone.replace(/[^+\d]/g,'')}>{attorney.phone}</a></p>}{attorney.email&&<p><a href={'mailto:'+attorney.email}>{attorney.email}</a></p>}{!attorney.address&&!attorney.phone&&!attorney.email&&<p>Contact information is not published in the directory.</p>}<h3 className="directory-review-heading">Client reviews</h3><p>No client reviews have been collected for this attorney.</p></section>
     </div>}
    </article>);
}
