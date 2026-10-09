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
 return ['lawofficesofmatthewchinesllc','lawofficesofmatthewchines','hineslawfirm','hineslaw'].includes(key)?hinesRoster:undefined;
}
