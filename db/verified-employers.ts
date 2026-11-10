import {firmKey} from '../app/api/attorneys/firm';
import type {EmploymentType} from '../app/employment';
// Exact organization identities checked against official sources on 2026-11-04.
// Classification concerns the recorded employer; it does not assert current employment.
export const verifiedEmployers:{names:string[];type:EmploymentType;source:string}[]=[
 {names:['The Coca-Cola Company','Coca-Cola Company'],type:'In House Counsel',source:'https://www.coca-colacompany.com/about-us'},
 {names:['The Home Depot','The Home Depot Inc','Home Depot Inc'],type:'In House Counsel',source:'https://corporate.homedepot.com/page/about-us'},
 {names:['Delta Air Lines Inc','Delta Air Lines'],type:'In House Counsel',source:'https://www.delta.com/us/en/about-delta/overview'},
 {names:['Georgia Department of Law','Georgia Office of the Attorney General'],type:'Government Attorney',source:'https://law.georgia.gov/about-us'},
 {names:['City of Atlanta Department of Law'],type:'Government Attorney',source:'https://www.atlantaga.gov/government/departments/law'},
 {names:['Georgia Public Defender Council'],type:'Government Attorney',source:'https://gapubdef.org/about'},
 {names:["DeKalb County District Attorney's Office"],type:'Government Attorney',source:'https://pacga.org/find-your-prosecutor/county/dekalb/'},
 {names:["Fulton County District Attorney's Office"],type:'Government Attorney',source:'https://www.fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/District-Attorney'},
 {names:['US Department of Justice','U.S. Department of Justice','United States Department of Justice'],type:'Government Attorney',source:'https://www.justice.gov/about'},
];
export function verifiedEmployer(name:string){const key=firmKey(name);return verifiedEmployers.find(entry=>entry.names.some(name=>firmKey(name)===key));}
