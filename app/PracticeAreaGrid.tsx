import {practiceIcon} from './practice-icons';
import type {PracticeCategory} from './practice-category';
export default function PracticeAreaGrid({areas}:{areas:PracticeCategory[]}){
 return <section className="discovery-section discover-practices" aria-labelledby="discover-practice-title"><div className="section-heading"><div><p className="section-kicker">FIND THE RIGHT KIND OF HELP</p><h1 id="discover-practice-title">Explore every practice area</h1></div></div><p className="section-description">Choose the type of legal help you need, or search above by attorney, firm, or location.</p><div className="practice-grid">{areas.map(area=><a className="practice-tile" href={'/practice-areas/'+area.id} key={area.id}><strong>{area.name}</strong><span>{area.description}</span><b aria-hidden="true">{practiceIcon(area.id)?<img className="practice-tile-icon" src={practiceIcon(area.id)} alt="" width={42} height={42} loading="lazy" decoding="async"/>:'↗'}</b></a>)}</div></section>;
}
