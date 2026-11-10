import {redirect} from 'next/navigation';
import {viewAsToken} from '../../db/view-as-cookie';
import adminStyles from "../admin.css?url";
import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {adminIdentity} from '../../db/admin-auth';
import AdminLogin from './AdminLogin';
import AdminShell from './AdminShell';
export const metadata:Metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
export const dynamic='force-dynamic';
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const h=await headers();
 if(viewAsToken(new Request('https://lawvetter.local/admin',{headers:h})))redirect('/account');
 const identity=await adminIdentity(new Request('https://lawvetter.local/admin',{headers:h}));
 return <><link rel="stylesheet" href={adminStyles} precedence="admin"/>{identity?<AdminShell>{children}</AdminShell>:<AdminLogin/>}</>;
}
