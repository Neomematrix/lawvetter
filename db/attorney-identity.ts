import {assertAttorneyAllowed} from './directory-deletions';
import {rawDb} from './raw';
import {newAttorneyId,georgiaBarProfile,georgiaProfileId,requireGeorgiaIdentity} from '../app/attorney-identity';
export async function directoryAttorneyId(state:string,license:string,source="",allowAdminRestore=false){
 if(!allowAdminRestore)await assertAttorneyAllowed(state,license);
 requireGeorgiaIdentity(state,license,source);
 const registryId=state==='GA'?georgiaProfileId(source):'';if(registryId)return registryId;
 if(!license)return state+':LV'+crypto.randomUUID().replaceAll('-','');
 const preferred=newAttorneyId(state,license);
 if(state!=='GA')return preferred;
 const occupied=await rawDb().prepare('SELECT state FROM attorneys WHERE bar_number=?').bind(preferred).first<{state:string}>();
 return occupied&&occupied.state!==state?state+':'+license:preferred;
}
export async function licensedAttorney(state:string,license:string,source=""){
 if(!license&&!source)return null;
 const canonical=state==='GA'?georgiaBarProfile(source):'';
 const byLicense=license?await rawDb().prepare('SELECT bar_number,state,name FROM attorneys WHERE state=? AND COALESCE(license_number,bar_number)=? LIMIT 1').bind(state,license).first<{bar_number:string;state:string;name:string}>():null;
 const profileSource=canonical||(source&&state!=='GA'?source:'');
 const bySource=profileSource?await rawDb().prepare('SELECT bar_number,state,name FROM attorneys WHERE state=? AND (source_url=? OR bar_number=?) LIMIT 1').bind(state,profileSource,canonical?georgiaProfileId(canonical):'').first<{bar_number:string;state:string;name:string}>():null;
 if(byLicense&&bySource&&byLicense.bar_number!==bySource.bar_number)throw Error('The bar number and official profile URL belong to different directory records. Review the existing profiles.');
 return byLicense||bySource;
}
