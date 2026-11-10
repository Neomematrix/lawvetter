'use client';
import GeorgiaDirectory from '../GeorgiaDirectory';
import ResponsiveHeader from '../ResponsiveHeader';
import type {PracticeCategory} from '../practice-category';
export default function DiscoverClient({areas}:{areas:PracticeCategory[]}){return <main className="discover-page"><ResponsiveHeader activeView="discover"/><GeorgiaDirectory discoveryPage practiceCategories={areas} onView={()=>window.location.assign('/discover')}/></main>;}
