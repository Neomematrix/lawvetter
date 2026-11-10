export const employmentTypes=['Law Firm Attorney','In House Counsel','Government Attorney'] as const;
export type EmploymentType=typeof employmentTypes[number];
export function employmentType(value:unknown):EmploymentType {
 if(value===undefined||value===null||value==='')return 'Law Firm Attorney';
 if(typeof value!=='string'||!employmentTypes.includes(value as EmploymentType))throw Error('Choose a valid employment type.');
 return value as EmploymentType;
}
export function employmentLabel(attorney:{employment_type?:string;employer_name?:string;company?:string}){
 const type=employmentType(attorney.employment_type),name=type==='Law Firm Attorney'?attorney.company:attorney.employer_name;
 return type+(name?.trim()?' at '+name.trim():'');
}
