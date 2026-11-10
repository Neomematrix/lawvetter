import type {Metadata} from 'next';
import SiteHeader from '../../SiteHeader';
import DeleteAccount from './DeleteAccount';
export const metadata:Metadata={title:'Delete my account | LawVetter',robots:{index:false,follow:false}};
export default function Page(){return <main><SiteHeader/><div className="page-shell account-page account-delete-page"><header className="account-delete-heading"><div><p className="section-kicker">ACCOUNT SETTINGS</p><h1>Delete my account</h1><p>Review what will be removed before you continue.</p></div><a className="account-delete-back" href="/dashboard">← Back to dashboard</a></header><DeleteAccount/></div></main>;}
