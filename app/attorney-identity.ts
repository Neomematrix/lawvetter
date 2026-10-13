// Legacy profile IDs stay unchanged so existing reviews, claims and links survive.
// New non-Georgia records use a state-qualified ID; public license numbers remain plain.
export function validAttorneyId(value:string){return /^(?:[A-Z]{2}:)?\d{1,20}$/.test(value);}
export function displayBarNumber(value:string){return value.replace(/^[A-Z]{2}:/,'');}
export function newAttorneyId(state:string,license:string){return state==='GA'?license:state+':'+license;}
