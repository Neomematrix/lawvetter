import SiteHeader from '../SiteHeader';
import AddListing from './AddListing';

export default function AddListingPage(){
 return <main><SiteHeader/><div className="page-shell add-listing-page"><p className="section-kicker">HELP GROW THE DIRECTORY</p><h1>Add a lawyer or law firm</h1><p className="add-listing-intro">Submit a missing U.S. lawyer or firm. LawVetter checks the official source you provide and holds every suggestion for owner review before it can enter the public directory.</p><AddListing/></div></main>;
}
