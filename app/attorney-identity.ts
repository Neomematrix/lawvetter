// Legacy profile IDs stay unchanged so existing reviews, claims and links survive.
// New non-Georgia records use a state-qualified ID; public license numbers remain plain.
export function validAttorneyId(value:string){return /^(?:LV[0-9a-f]{32}|(?:[A-Z]{2}:)?\d{1,20}|[A-Z]{2}:LV[0-9a-f]{1,64})$/.test(value);}
export function displayBarNumber(value:string){return !value||value.startsWith('LV')||/^[A-Z]{2}:LV/.test(value)?'':value.replace(/^[A-Z]{2}:/,'');}
export function newAttorneyId(state:string,license:string){return state==='GA'?license:state+':'+license;}
// Spreadsheets may qualify licenses as FL-123473 or FL:123473.
// Keep state in its own field and match the existing state/license identity.
export function normalizeBarNumber(state:string,value:string){const jurisdiction=state.trim().toUpperCase();let license=value.trim();const prefix=license.match(/^([A-Za-z]{2})[-:\s]+(.+)$/);if(prefix){if(prefix[1].toUpperCase()!==jurisdiction)throw Error('Bar-number prefix does not match the State column.');license=prefix[2].trim();}if(!/^[A-Za-z0-9]{1,20}$/.test(license))throw Error('Enter a valid bar number, such as 123473 or FL-123473.');return jurisdiction==='GA'&&/^\d+$/.test(license)?license.padStart(6,'0'):license;}

// Georgia's directory uses a permanent registry ID even when no bar number is public.
export function georgiaBarProfile(value:string){
 try{const u=new URL(value);if(u.protocol!=='https:'||!['gabar.org','www.gabar.org'].includes(u.hostname.toLowerCase())||u.username||u.password||u.port||u.pathname.replace(/\/$/,'')!=='/member-directory')return '';const id=u.searchParams.get('id');return id&&/^[a-f0-9]{1,64}$/i.test(id)?'https://www.gabar.org/member-directory/?id='+id.toUpperCase():'';}catch{return '';}
}
export function requireGeorgiaIdentity(state:string,license:string,source:string){if(state==='GA'&&!license&&!georgiaBarProfile(source))throw Error('Provide the official Georgia Bar member profile URL when the bar number is unavailable.');}
export function georgiaProfileId(source:string){const url=georgiaBarProfile(source);return url?'GA:LV'+new URL(url).searchParams.get('id')!.toLowerCase():'';}
