import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {profileIdentity} from '../../../db/profile-access';
import VerificationQueue from './VerificationQueue';
export const dynamic='force-dynamic';
export default async function Page(){const h=await headers();if(!profileIdentity(new Request('https://counsel.local/admin/client-reviews',{headers:h})).admin)notFound();return <VerificationQueue/>;}
