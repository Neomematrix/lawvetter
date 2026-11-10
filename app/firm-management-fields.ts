import {splitPracticeAreas} from './practice-category';
import {validateFirmLocations} from './firm-locations';
import {stateSearch} from './us-states';
import {linkedInUrl} from './linkedin-url';
export function firmText(data:Record<string,unknown>,field:string,max:number){const value=data[field]??'';if(typeof value!=='string'||value.length>max||/[<>]/.test(value))throw Error('Invalid '+field+'.');return value.trim();}
export function firmWebsite(value:string){if(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Use an HTTPS website address.');}return value;}
export function firmContactFields(data:Record<string,unknown>){const address=firmText(data,'address',500),city=firmText(data,'city',120),state=firmText(data,'state',2).toUpperCase(),zip=firmText(data,'zip',10),phone=firmText(data,'phone',80),email=firmText(data,'email',254);if(state&&!stateSearch(state))throw Error('Choose a valid state.');if(zip&&!/^\d{5}(-\d{4})?$/.test(zip))throw Error('Enter a valid ZIP code.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');return {address,city,state,zip,phone,email};}
export function firmSettingsFields(data:Record<string,unknown>){return {...firmContactFields(data),practiceAreas:data.practice_areas===undefined?undefined:firmPracticeAreas(data.practice_areas),website:firmWebsite(firmText(data,'website',2000)),linkedin:linkedInUrl(data.linkedin_url,'firm')??'',biography:firmText(data,'biography',5000),locations:JSON.stringify(validateFirmLocations(data.additional_locations??'[]'))};}

export function firmPracticeAreas(value:unknown){if(typeof value!=='string'||value.length>500||/[<>]/.test(value))throw Error('Choose practice areas of 500 characters or fewer.');return splitPracticeAreas(value).join(', ');}
