import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {profileIdentity} from '../../db/profile-access';
export const metadata:Metadata={robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const h=await headers();
 const identity=profileIdentity(new Request('https://lawvetter.local/admin',{headers:h}));
 if(!identity.admin)notFound();
 return children;
}
