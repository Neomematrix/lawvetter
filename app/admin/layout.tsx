import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {adminIdentity} from '../../db/admin-auth';
import AdminLogin from './AdminLogin';
import AdminLogout from './AdminLogout';
export const metadata:Metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
export const dynamic='force-dynamic';
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const h=await headers();
 const identity=await adminIdentity(new Request('https://lawvetter.local/admin',{headers:h}));
 if(!identity)return <AdminLogin/>;
 return <><AdminLogout/>{children}</>;
}
