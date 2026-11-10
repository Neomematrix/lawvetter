import {usStates} from './us-states';
export type FirmLocation={address:string;city:string;state:string;zip:string;phone:string;email:string};
export const MAX_FIRM_LOCATIONS=25;
export function emptyFirmLocation():FirmLocation{return {address:'',city:'',state:'',zip:'',phone:'',email:''};}
export function readFirmLocations(value:unknown):FirmLocation[]{try{const locations=typeof value==='string'?JSON.parse(value):value;return Array.isArray(locations)?locations.map(row=>({...emptyFirmLocation(),...row})):[];}catch{return [];}}
export function validateFirmLocations(value:unknown):FirmLocation[]{
 if(value===undefined)return [];
 let rows:unknown;try{rows=typeof value==='string'?JSON.parse(value):value;}catch{throw Error('Invalid firm locations.');}
 if(!Array.isArray(rows)||rows.length>MAX_FIRM_LOCATIONS)throw Error('Enter up to 25 additional firm locations.');
 return rows.map((row,index)=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid location '+(index+2)+'.');const data=row as Record<string,unknown>,result=emptyFirmLocation();
  for(const [field,max] of [['address',500],['city',120],['state',2],['zip',10],['phone',80],['email',254]] as const){const v=data[field]??'';if(typeof v!=='string'||v.length>max||/[<>]/.test(v))throw Error('Invalid '+field+' for location '+(index+2)+'.');result[field]=v.trim();}
  result.state=result.state.toUpperCase();
  if(!result.address||!result.city||!usStates.some(state=>state===result.state))throw Error('Enter street address, city, and a valid state for location '+(index+2)+'.');
  if(result.zip&&!/^\d{5}(-\d{4})?$/.test(result.zip))throw Error('Enter a valid ZIP code for location '+(index+2)+'.');
  if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw Error('Enter a valid email for location '+(index+2)+'.');
  return result;
 });
}
