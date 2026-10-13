import {rawDb} from './raw';
import {newAttorneyId} from '../app/attorney-identity';
export async function directoryAttorneyId(state:string,license:string){
 const preferred=newAttorneyId(state,license);
 if(state!=='GA')return preferred;
 const occupied=await rawDb().prepare('SELECT state FROM attorneys WHERE bar_number=?').bind(preferred).first<{state:string}>();
 return occupied&&occupied.state!==state?state+':'+license:preferred;
}
export async function licensedAttorney(state:string,license:string){
 return rawDb().prepare('SELECT bar_number,state,name FROM attorneys WHERE state=? AND COALESCE(license_number,bar_number)=? LIMIT 1').bind(state,license).first<{bar_number:string;state:string;name:string}>();
}
