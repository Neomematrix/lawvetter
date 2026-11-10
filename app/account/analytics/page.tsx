import type {Metadata} from 'next';
import SiteHeader from '../../SiteHeader';
import ActivityPanel from '../../ActivityPanel';
export const metadata:Metadata={title:'Profile analytics',robots:{index:false,follow:false}};
export default function Page(){return <main><SiteHeader/><div className="page-shell account-page"><div className="account-activity-heading"><h1>Your profile activity</h1><a className="outline-button" href="/dashboard">Back to dashboard</a></div><ActivityPanel/></div></main>;}
