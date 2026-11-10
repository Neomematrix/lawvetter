import adminStyles from "../admin.css?url";
import type {Metadata} from 'next';
import AdminLogin from '../admin/AdminLogin';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Administrator login',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <><link rel="stylesheet" href={adminStyles} precedence="admin"/><AdminLogin/></>;}
