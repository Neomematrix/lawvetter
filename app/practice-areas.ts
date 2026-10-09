import publishedIndex from './practice-index';
export const practiceAreas = [
 {id:'family-law',name:'Family law',description:'Divorce, custody & family matters'},
 {id:'litigation',name:'Litigation',description:'Disputes & courtroom representation'},
 {id:'personal-injury',name:'Personal injury',description:'Injuries, accidents & liability'},
 {id:'criminal-defense',name:'Criminal defense',description:'Criminal charges & defense'},
 {id:'employment-law',name:'Employment law',description:'Workplace rights & disputes'},
 {id:'estate-planning',name:'Estate planning',description:'Wills, trusts & probate'},
 {id:'business-law',name:'Business law',description:'Companies, contracts & transactions'},
 {id:'immigration',name:'Immigration',description:'Visas, residency & citizenship'},
];
// Curated from the linked professional sources; checked October 8–9, 2026.
// These supplement the Bar roster, which does not contain practice areas.
const originalSources:Record<string,{areas:string[];url:string}> = {
 '231458':{areas:['family-law'],url:'https://www.emcfamilylaw.com/staff-profiles/theodore-s-eittreim/'},
 '360208':{areas:['family-law','litigation','personal-injury','criminal-defense'],url:'https://www.banksstubbs.com/attorneys/eric-j-tatum/'},
 '646135':{areas:['employment-law','litigation'],url:'https://www.justiceatwork.com/our-team/amanda-a-farahany/'},
 '282450':{areas:['estate-planning','business-law'],url:'https://www.gabar.org/lawyers/member-benefits---resources/speaker-clearinghouse/speaker-detail/282450'},
 '429940':{areas:['immigration'],url:'https://immigration.net/our-people/our-people-bios/'},
};
export const practiceSources:Record<string,{areas:string[];url:string;sources:Record<string,string>}> = {...publishedIndex};
for (const [bar, source] of Object.entries(originalSources)) {
 const existing=practiceSources[bar];
 practiceSources[bar]={areas:[...new Set([...(existing?.areas||[]),...source.areas])],url:existing?.url||source.url,sources:{...Object.fromEntries(source.areas.map(area=>[area,source.url])),...existing?.sources}};
}
export function practiceSourceUrl(bar:string,area:string){return practiceSources[bar]?.sources[area];}
export const practiceCoverage='Practice-area coverage is being expanded. Results include published practice information and details supplied by approved profile owners; the State Bar roster does not classify every attorney by practice.';
