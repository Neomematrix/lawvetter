// Public responses suppress the displayed license; stored identity and lookup remain intact.
export function publicLicenseColumn(alias='attorneys'){
 return "'' AS license_number";
}
export function publicAttorneyColumns(alias='attorneys'){
 const columns=['public_id','bar_number','source_id','name','company','employment_type','employer_name','employer_website','city','state','county','status','admit_date','law_school','address','zip','phone','email','source_url','imported_at','owner_edited'];
 return columns.map(column=>alias+'.'+column).join(',')+','+publicLicenseColumn(alias);
}
