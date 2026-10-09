import SiteHeader from '../SiteHeader';
import {ShortlistNavLink} from '../Shortlist';
import type {ReactNode} from 'react';
export default function NewsLayout({children}:{children:ReactNode}){return <><SiteHeader/>{children}<footer><div className="footer-brand"><strong>COUNSELCHECK</strong></div><p>Legal news, with the source in view.</p><div><a href="/">Find an attorney</a><a href="/news">All settlement stories</a></div><small>© 2026 CounselCheck. Independent summaries of official announcements. No government affiliation or endorsement.</small></footer></>}
