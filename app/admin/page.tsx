import Link from 'next/link';
import SiteHeader from '../SiteHeader';

export const dynamic = 'force-dynamic';

const sections = [
  {href:'/admin/claims',title:'Attorney profile claims',description:'Review requests to claim and manage attorney profiles.'},
  {href:'/admin/client-reviews',title:'Client review verification',description:'Review supporting evidence and approve or reject client verification.'},
  {href:'/admin/directory-submissions',title:'Attorney submissions',description:'Review attorney details submitted to the directory.'},
  {href:'/admin/leads',title:'Client inquiries',description:'Track inquiries, email notification status, and attorney acknowledgments.'},
  {href:'/admin/searches',title:'Search analytics',description:'See how visitors use the attorney directory.'}
];

export default function AdminHome() {
  return <main><SiteHeader/><div className="page-shell account-page">
    <p className="section-kicker">OWNER ADMINISTRATION</p>
    <h1>LawVetter admin dashboard</h1>
    <p>Private owner workspace. Manage attorney claims, submissions, reviews, inquiries, and search activity.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:16,marginTop:24}}>
      {sections.map(s=><section key={s.href} className="lead-card">
        <h2>{s.title}</h2><p>{s.description}</p><Link className="outline-button" href={s.href}>Open section</Link>
      </section>)}
    </div>
    <section className="lead-card" style={{marginTop:24}}>
      <h2>Bulk attorney import</h2>
      <p>The existing protected import API is not an Excel upload interface. Uploading XLSX/CSV will require a separate validated importer and an owner-only admin screen. Do not paste import secrets into the website.</p>
    </section>
  </div></main>;
}
