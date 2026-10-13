import {decodeAttorneyDraft,encodeAttorneyDraft} from './attorney-submission';
export type Notice={payload:string;status:'pending'|'accepted';firstAttempt?:number;leaseUntil?:number;providerId?:string};
type Details={practiceAreas?:string;photoKey?:string;notes:string;firmWebsite:string;notice?:Notice};
const prefix='LAWVETTER_DIRECTORY_DETAILS_V1\n';
export function directoryDetails(notes:string):Details{const attorney=decodeAttorneyDraft(notes);if(attorney)return {practiceAreas:attorney.practiceAreas,notes:attorney.notes,firmWebsite:attorney.firmWebsite||'',notice:attorney.notice};if(notes.startsWith(prefix)){try{const d=JSON.parse(notes.slice(prefix.length));if(typeof d.notes==='string'&&typeof d.firmWebsite==='string')return d;}catch{}}return {notes,firmWebsite:''};}
export function withDirectoryDetails(notes:string,changes:Partial<Details>){const attorney=decodeAttorneyDraft(notes);if(attorney)return encodeAttorneyDraft({...attorney,...changes});return prefix+JSON.stringify({...directoryDetails(notes),...changes});}
