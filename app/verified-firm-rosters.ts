// Official roster checked 2026-10-09. Bar identities matched against imported
// names, firm affiliations and education; preserve original Bar records.
export const hinesRoster = {
 name:'Law Offices of Matthew C Hines LLC',
 source:'https://hineslaw.org/attorneys/',checked:'2026-10-09',
 bars:['356082','469075','971805','428495','504883','639998','196909','625975','508281','294584','142955','214647','920870'],
 additional:[
  {name:'James Vance Montgomery',jurisdiction:'Tennessee',practice:'Personal injury',url:'https://hineslaw.org/team/vance-montgomery/'},
  {name:'Kenneth Mitchell',jurisdiction:'Texas',practice:'Personal injury',url:'https://hineslaw.org/team/kenneth-mitchell/'}
 ]
};
export function verifiedFirmRoster(key:string){
 if(['kesslerandsolomianyllc','kesslerandsolomianyfamilylaw'].includes(key))return kesslerRoster;
 return ['lawofficesofmatthewchinesllc','lawofficesofmatthewchines','hineslawfirm','hineslaw'].includes(key)?hinesRoster:undefined;
}
export const kesslerRoster:typeof hinesRoster={
 name:'Kessler & Solomiany LLC',source:'https://www.ksfamilylaw.com/attorneys/',checked:'2026-10-09',
 bars:['004170','665798','142015','424064','526375','349724','826770','503793','108562','390087','133392','355086','864339','636618','875149','025208','379617','553775','681971'],additional:[],
};
export function verifiedFirmForAttorney(bar:string){return [hinesRoster,kesslerRoster].find(roster=>roster.bars.includes(bar));}
