import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {clientIdentity} from '../../db/client-auth';
import {accountDashboardPath} from '../../db/account-dashboard';
import {SITE_ORIGIN} from '../seo';
import SiteHeader from '../SiteHeader';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Dashboard | LawVetter',robots:{index:false,follow:false}};

export default async function Page() {
 let destination:string;
 try {
  const client=await clientIdentity(new Request(SITE_ORIGIN+'/dashboard',{headers:await headers()}));
  destination=client?await accountDashboardPath(client):'/client-reviews';
 } catch {
  return <main><SiteHeader/><div className="page-shell account-page"><h1>Dashboard</h1><p role="alert">Your dashboard could not be loaded. Please try again.</p><a className="gold-button" href="/dashboard">Try again</a></div></main>;
 }
 redirect(destination);
}
