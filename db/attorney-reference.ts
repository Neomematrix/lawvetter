import {rawDb} from './raw';
export const isPublicReference=(value:string)=>/^LV[0-9a-f]{32}$/.test(value);
export async function resolveAttorneyReference(value:string){if(!isPublicReference(value))return value;return (await rawDb().prepare('SELECT bar_number FROM attorneys WHERE public_id=?').bind(value.slice(2)).first<{bar_number:string}>())?.bar_number||'';}
export async function resolveVerificationReference(value:string){try{const parsed=JSON.parse(value);if(Array.isArray(parsed)&&parsed.length===2&&typeof parsed[0]==='string'&&typeof parsed[1]==='string'&&isPublicReference(parsed[1]))return JSON.stringify([parsed[0],await resolveAttorneyReference(parsed[1])]);}catch{}return value;}
