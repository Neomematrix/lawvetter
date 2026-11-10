import type {Metadata} from 'next';
import SiteHeader from '../SiteHeader';
import AccessRequest from './AccessRequest';
export const metadata:Metadata={title:'Firm management access',robots:{index:false,follow:false}};
export default function Page(){return <main><SiteHeader/><div className="page-shell firm-access-page"><AccessRequest/></div></main>;}
