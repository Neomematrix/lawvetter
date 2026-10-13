export type SearchSponsor={name:string;headline:string;description:string;url:string};
// Keep empty placements hidden until an actual sponsor is contracted and supplied.
export function activeSearchSponsor():SearchSponsor|null{return null;}
export default function SearchAdvertisement(){
 const sponsor=activeSearchSponsor();
 if(!sponsor)return null;
 return <aside className="search-advertisement" aria-label="Advertisement">
  <p className="advertisement-label">Advertisement</p>
  <p className="section-kicker">{sponsor.name}</p>
  <h2>{sponsor.headline}</h2>
  <p>{sponsor.description}</p>
  <a className="advertisement-availability" href={sponsor.url} target="_blank" rel="noopener noreferrer sponsored">Visit Sponsor</a>
  <small>Paid placement. Sponsorship does not affect attorney ratings or rankings.</small>
 </aside>;
}
