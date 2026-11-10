import {firmLawyerDefaults} from '../firm-lawyer-entry';
import {siteOrigin,publicSettings} from '../../db/site-settings';
import SiteHeader from '../SiteHeader';
import AddListing from './AddListing';
import type {Metadata} from 'next';
import {SITE_ORIGIN} from '../seo';

export async function generateMetadata():Promise<Metadata>{const settings=await publicSettings(),SITE_ORIGIN=settings.origin;return {title:'Add a Lawyer or Law Firm',description:'Suggest a missing U.S. lawyer or law firm for review before it is added to the LawVetter directory.',alternates:{canonical:SITE_ORIGIN+'/add-listing'}};}

export default async function AddListingPage({searchParams}:{searchParams:Promise<{claim?:string;firm?:string;firmWebsite?:string}>}){
 const params=await searchParams,ownershipRequest=params.claim==='1',entry=firmLawyerDefaults(params.firm,params.firmWebsite);
 return <main><SiteHeader/><div className="page-shell add-listing-page"><p className="section-kicker">{ownershipRequest?'FIRM OWNERSHIP REVIEW':'HELP GROW THE DIRECTORY'}</p><h1>{ownershipRequest?'Request firm ownership review':'Add a lawyer or law firm'}</h1><p className="add-listing-intro">{ownershipRequest?'Provide your firm email, official website, and evidence that you are authorized to represent the firm. The administrator reviews your request.':'Suggest a missing lawyer or firm. We review each submission before publication.'}</p><AddListing ownershipRequest={ownershipRequest} initialFirm={entry.firm} initialFirmWebsite={entry.firmWebsite}/></div></main>;
}
