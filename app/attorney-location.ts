import {usStates} from './us-states';

export function requireAttorneyLocation(city:unknown,state:unknown){
 if(typeof city!=='string'||!city.trim()||/^(city not listed|not listed|unknown|n\/a)$/i.test(city.trim()))throw Error('Enter the lawyer’s city.');
 if(typeof state!=='string'||!usStates.some(code=>code===state.trim().toUpperCase()))throw Error('Select the lawyer’s state.');
}
