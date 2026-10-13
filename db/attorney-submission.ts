// Private draft details stay in the existing directory-submission record.
const prefix='LAWVETTER_ATTORNEY_PROFILE_V1\n';
import type {Notice} from './directory-details';
export type AttorneyDraft={firmWebsite?:string;notice?:Notice;owner:string;headline:string;bio:string;practiceAreas:string;photoKey:string;phone:string;publicEmail:string;address:string;county:string;admitDate:string;lawSchool:string;notes:string};
export function encodeAttorneyDraft(draft:AttorneyDraft){return prefix+JSON.stringify(draft);}
export function decodeAttorneyDraft(notes:string):AttorneyDraft|null{if(!notes.startsWith(prefix))return null;try{const draft=JSON.parse(notes.slice(prefix.length));return draft&&typeof draft==='object'&&!!draft.owner&&['owner','headline','bio','practiceAreas','photoKey','phone','publicEmail','address','county','admitDate','lawSchool','notes'].every(k=>typeof draft[k]==='string')?draft:null;}catch{return null;}}
