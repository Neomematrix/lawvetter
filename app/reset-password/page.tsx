import SiteHeader from '../SiteHeader';
import ClientAccountGate from '../client-reviews/ClientAccountGate';
import type {Metadata} from 'next';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Reset Password | LawVetter',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <main><SiteHeader/><ClientAccountGate bar="" initialMode="reset-password"/></main>;}
