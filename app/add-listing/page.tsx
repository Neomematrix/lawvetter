import SiteHeader from '../SiteHeader';
import AddListing from './AddListing';
import type {Metadata} from 'next';
import {SITE_ORIGIN} from '../seo';

export const metadata:Metadata={title:'Add a Lawyer or Law Firm',description:'Suggest a missing U.S. lawyer or law firm for review before it is added to the LawVetter directory.',alternates:{canonical:SITE_ORIGIN+'/add-listing'}};

export default function AddListingPage(){
 return <main><SiteHeader/><div className="page-shell add-listing-page"><p className="section-kicker">HELP GROW THE DIRECTORY</p><h1>Add a lawyer or law firm</h1><p className="add-listing-intro">Submit a missing U.S. lawyer or firm. LawVetter checks the official source you provide and holds every suggestion for owner review before it can enter the public directory.</p><AddListing/></div></main>;
}
