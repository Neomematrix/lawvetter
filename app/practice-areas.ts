import publishedIndex from './practice-index';
import {kesslerRoster} from './verified-firm-rosters';
// Curated from the linked professional sources; checked October 8–9, 2026.
// These supplement the Bar roster, which does not contain practice areas.
const originalSources:Record<string,{areas:string[];url:string}> = {
 '004170':{areas:['family-law','litigation'],url:'https://www.ksfamilylaw.com/attorneys/randall-m-kessler/'},
 '356082':{areas:['personal-injury','criminal-defense'],url:'https://hineslaw.org/'},
 '231458':{areas:['family-law'],url:'https://www.emcfamilylaw.com/staff-profiles/theodore-s-eittreim/'},
 '360208':{areas:['family-law','litigation','personal-injury','criminal-defense'],url:'https://www.banksstubbs.com/attorneys/eric-j-tatum/'},
 '646135':{areas:['employment-law','litigation'],url:'https://www.justiceatwork.com/our-team/amanda-a-farahany/'},
 '282450':{areas:['estate-planning','business-law'],url:'https://www.gabar.org/lawyers/member-benefits---resources/speaker-clearinghouse/speaker-detail/282450'},
 '429940':{areas:['immigration'],url:'https://immigration.net/our-people/our-people-bios/'},
 '501513':{areas:['family-law','litigation','estate-planning'],url:'https://crossfamilylaw.com/team/kelsie-royal-cross/'},
 '238455':{areas:['family-law','litigation'],url:'https://crossfamilylaw.com/team/brennan-j-mcelhone/'},
 '128532':{areas:['family-law'],url:'https://crossfamilylaw.com/team/megan-long/'},
};
export const practiceSources:Record<string,{areas:string[];url:string;sources:Record<string,string>}> = {...publishedIndex};
for(const bar of kesslerRoster.bars){
 originalSources[bar]??={areas:['family-law'],url:kesslerRoster.source};
}
for (const [bar, source] of Object.entries(originalSources)) {
 const existing=practiceSources[bar];
 practiceSources[bar]={areas:[...new Set([...(existing?.areas||[]),...source.areas])],url:existing?.url||source.url,sources:{...Object.fromEntries(source.areas.map(area=>[area,source.url])),...existing?.sources}};
}
export function practiceSourceUrl(bar:string,area:string){return practiceSources[bar]?.sources[area];}
export {practiceAreas,searchPracticeArea} from './practice-catalog';
